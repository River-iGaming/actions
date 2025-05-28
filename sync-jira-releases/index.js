const github = require("@actions/github");
const core = require("@actions/core");

(async () => {

	const jiraUrl = core.getInput("jira-url", { required: true });
	const jiraApiToken = core.getInput("jira-api-token", { required: true });
	const jiraUser = core.getInput("jira-user", { required: true });

	console.log(`Syncing Jira releases...${jiraUrl}, ${jiraUser}, ${jiraApiToken} `);

	const { Version3Client } = await import("jira.js");

	const projectKeyMap = { "RTVX": 10110, "RTTH": 10109, "RTMG": 10111 };

	const client = new Version3Client({
		host: jiraUrl, //"https://rivertechnologies.atlassian.net",
		authentication: {
			basic: {
				email: jiraUser,
				apiToken: jiraApiToken,
			},
		},
	});

	// const branch = github.context.ref.replace("refs/heads/", "");
	// // const packageVersion = core.getInput("package-version");
	// // const version = core.getInput("app-version");
	// // const runNumber = github.context.runNumber;
	// const release = github.context.payload.release;
	const release = {
		name: "v1.2.3",
		tag_name: "v1.2.3",
		body: "## What's Changed\n- Fixed critical bug in authentication\n- Added new user dashboard\n- Improved performance by 25%",
		draft: false,
		prerelease: false,
		created_at: "2024-01-15T10:30:00Z",
		published_at: "2024-01-15T11:00:00Z",
		author: {
			login: "developer",
			id: 12345
		},
		assets: []
	};

	const projects = await client.projects.searchProjects();
	const testProjects = projects.values.filter(p => p.key.startsWith("RT") > 0);

	console.log(testProjects.map(p => `${p.key} - ${p.id}`).join("\n"));

	const jiraRelease = await client.projectVersions.createVersion({
		name: release.name,
		description: release.body,
		projectId: 10057, // test
		project: "RT",
		startDate: new Date(release.created_at).toISOString().split("T")[0], // Format to YYYY-MM-DD
		// releaseDate: new Date(release.published_at).toISOString().split("T")[0], // Format to YYYY-MM-DD
		released: false, // Set to true if you want to immediately mark as released
	});

	// console.log(`Created Jira release: ${jiraRelease.name} with ID: ${jiraRelease.id}`);
})();