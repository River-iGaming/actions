const github = require("@actions/github");
const core = require("@actions/core");
const { setTimeout } = require("timers/promises");

(async () => {

	const jiraUrl = core.getInput("jira-url", { required: true });
	const jiraApiToken = core.getInput("jira-api-token", { required: true });
	const jiraUser = core.getInput("jira-user", { required: true });

	console.log(`Syncing Jira releases for ${jiraUrl} -> 🚀`);

	const { Version3Client } = await import("jira.js");

	const client = new Version3Client({
		host: jiraUrl ?? "https://rivertechnologies.atlassian.net",
		authentication: {
			basic: {
				email: jiraUser ?? "atlassian.api@river.tech",
				apiToken: jiraApiToken
			},
		},
	});

	const release = github.context.payload.release;
	const runNumber = github.context.runNumber;
	let releaseName = release?.name;
	let releaseBody = release?.body ?? "";
	let releaseCreatedAt = release?.created_at ?? new Date().toISOString();
	let isReleaseByBranch = !release;

	if (isReleaseByBranch) {
		console.log(`Branch release creation detected...`);

		const releaseBranch = github.context.ref.replace("refs/heads/", "");
		console.log(`Branch name... ${releaseBranch}`);
		if (releaseBranch.startsWith("release/") === -1) {
			throw `Branch ${releaseBranch} is not a 'release' branch ❌`;
		}

		releaseName = releaseBranch.replace("release/", "");
		// releaseBody = `Release branch created: ${releaseBranch}`;
	}

	const projects = await client.projects.searchProjects();
	const projectKeyMap = projects.values
		.filter(p => p.key.startsWith("RT"))
		.reduce((prev, curr) => {
			prev[curr.key.toUpperCase()] = curr.id;
			return prev;
		}, {});
	;

	const releaseKeys = { "MGM": "RTMG", "THN": "RTTH", "VTX": "RTVX", "TST": "RT" }

	const nameParts = releaseName.split("-").map(s => s.trim().toUpperCase());

	if (isReleaseByBranch && nameParts.length < 2) {
		console.log(`🏁 Release name ${releaseName} does not follow the expected format. Assuming it's not a branch release. Create release through GitHub.`);
		return;
	}

	const projectReleaseKey = nameParts[0]; // Assuming the first part is the project key
	if (!releaseKeys[projectReleaseKey]) {
		throw `Release key ${projectReleaseKey} Invalid.`;
	}

	const projectKey = releaseKeys[projectReleaseKey];
	if (!projectKey) {
		throw `Project key ${projectReleaseKey} not found in release keys.`;
	}

	const projectId = projectKeyMap[projectKey];
	if (!projectId) {
		throw `Project with key ${projectKey} not found in Jira projects.`;
	}

	const component = nameParts[1];
	if (!component) {
		throw `Component not found in release name: ${component}`;
	}

	console.log(`Release Key is ${projectReleaseKey} resolved:: Project ID for ${projectKey} is ${projectId} and component is ${component}`);

	const versions = await client.projectVersions.getProjectVersions({
		projectIdOrKey: projectKey
	});

	const existingVersion = versions.find(v => v.name.toUpperCase() === releaseName.toUpperCase());
	if (existingVersion) {
		console.log(`Release version ${releaseName} already exists in Jira. Skipping creation.`);
		return;
	}

	const jiraRelease = await client.projectVersions.createVersion({
		name: releaseName,
		description: releaseBody,
		projectId: projectId, //10057, // test
		project: projectKey, //"RT",
		startDate: new Date(releaseCreatedAt).toISOString().split("T")[0], // Format to YYYY-MM-DD
		// releaseDate: new Date(release.published_at).toISOString().split("T")[0], // Format to YYYY-MM-DD
		released: false
	});


	console.log(`Created Jira release: ${jiraRelease.name} with ID: ${jiraRelease.id} ✅`);
	await setTimeout(10000); // Wait to ensure the release is created

	const issuesResult = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
		jql: `project = "${projectKey}" AND summary ~ "${releaseName}"`,
		fields: ['summary', 'status', 'assignee', 'priority', 'issuetype'],
		maxResults: 1
	});

	const releaseTicket = issuesResult.issues[0]?.id;
	if (!releaseTicket) {
		console.warn(`Release ticket not found for release: ${releaseName}`);
		return;
	}

	console.log(`Found release ticket: ${releaseTicket} for release: ${releaseName}`);

	const transitionsResult = await client.issues.getTransitions({
		issueIdOrKey: releaseTicket
	});

	const lockedTransitionId = transitionsResult.transitions.find(t => t.name.toLowerCase() === "locked")?.id;
	if (!lockedTransitionId) {
		console.warn(`No 'Locked' transition found for issue: ${releaseTicket}`);
		return;
	}

	await client.issues.doTransition({
		issueIdOrKey: releaseTicket,
		transition: {
			id: lockedTransitionId
		}
	});

	await client.projectVersions.updateVersion({
		id: jiraRelease.id,
		description: `${nameParts[0]}-${nameParts[1]}-${runNumber}`,
	});

	console.log(`🔒 Transitioned release ticket ${releaseTicket} to 'Locked' state successfully.`);
})().catch((error) => {
	console.error(error);
	core.setFailed(`❌ Syncing Jira releases failed: ${error.message}`);
});