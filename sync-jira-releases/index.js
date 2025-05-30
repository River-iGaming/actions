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

	// const branch = github.context.ref.replace("refs/heads/", "");
	// // const packageVersion = core.getInput("package-version");
	// // const version = core.getInput("app-version");
	// const runNumber = github.context.runNumber;

	const release = github.context.payload.release;
	// const release = {
	// 	name: "TST-DNET-ThunderWheel6618",
	// 	tag_name: "1.2.6618",
	// 	body: "## What's Changed\n- Fixed critical bug in authentication\n- Added new user dashboard\n- Improved performance by 25%",
	// 	draft: false,
	// 	prerelease: true,
	// 	created_at: "2024-01-15T10:30:00Z",
	// 	published_at: "2024-01-15T11:00:00Z",
	// 	author: {
	// 		login: "developer",
	// 		id: 12345
	// 	},
	// 	assets: []
	// };

	const projects = await client.projects.searchProjects();
	const projectKeyMap = projects.values
		.filter(p => p.key.startsWith("RT") > 0)
		.reduce((prev, curr) => {
			prev[curr.key.toUpperCase()] = curr.id;
			return prev;
		}, {});
	;

	const releaseKeys = { "MGM": "RTMG", "THN": "RTTH", "VTX": "RTVX", "TST": "RT" }

	const nameParts = release.name.split("-").map(s => s.trim().toUpperCase());
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

	const jiraRelease = await client.projectVersions.createVersion({
		name: release.name,
		description: release.body,
		projectId: projectId, //10057, // test
		project: projectKey, //"RT",
		startDate: new Date(release.created_at).toISOString().split("T")[0], // Format to YYYY-MM-DD
		// releaseDate: new Date(release.published_at).toISOString().split("T")[0], // Format to YYYY-MM-DD
		released: false, // Set to true if you want to immediately mark as released
	});


	console.log(`Created Jira release: ${jiraRelease.name} with ID: ${jiraRelease.id} ✅`);
	await setTimeout(10000); // Wait to ensure the release is created

	// client.projectVersions.getVersion({
	// 	projectId: projectId,
	// 	versionId: jiraRelease.id
	// });;

	const issuesResult = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
		jql: `project = "${projectKey}" AND summary ~ "${release.name}"`,
		fields: ['summary', 'status', 'assignee', 'priority', 'issuetype'],
		maxResults: 1
	});

	const releaseTicket = issuesResult.issues[0]?.id;
	if (!releaseTicket) {
		console.warn(`Release ticket not found for release: ${release.name}`);
		return;
	}

	console.log(`Found release ticket: ${releaseTicket} for release: ${release.name}`);

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

	console.log(`Transitioned release ticket ${releaseTicket} to 'Locked' state successfully. 🔒`);
})();