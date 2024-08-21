const core = require("@actions/core");
const github = require("@actions/github");

try {
	const version = core.getInput("package-version", { required: true });
	const type = core.getInput("type", { required: true });

	const branch =
		github.context.eventName === "pull_request"
			? github.context.payload.pull_request.head.ref
			: github.context.ref.replace("refs/heads/", "");
	const runNumber = github.context.runNumber;

	console.log(`Branch ${branch}`);
	console.log(`Version: ${version}`);
	let buildVersion;

	// switch is really redundant here, but leaving it here in case we need to separate logic
	switch (type) {
		case "lib":
			buildVersion = generateVersionString(branch, version, runNumber);
			break;
		case "deploy":
			buildVersion = generateVersionString(branch, version, runNumber);
			break;
		default:
			throw Error(`'${type}' is not a valid type for this action.`);
	}

	const versionSegments = buildVersion.split(".");
	const [major, minor, patch] = versionSegments;

	core.notice(`Version: ${buildVersion}`);
	core.setOutput("version", buildVersion);
	core.setOutput("major-version", major);
	core.setOutput("minor-version", minor);
	core.setOutput("patch-version", patch);
	core.setOutput("branch-name", branch);
	core.setOutput("app-version", buildVersion); // todo: deprecated remove
} catch (error) {
	if (error instanceof Error) {
		core.setFailed(error.message);
	} else {
		core.setFailed(`An unexpected error occurred. Error: ${error}`);
	}
}

function generateVersionString(branch, version, runNumber) {
	if (branch === "main" || branch === "master" || branch === "master-testing") {
		return generateFinalVersionName(version, "dev", runNumber);
	}

	if (branch.startsWith("feature")) {
		return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
	}

	if (branch.startsWith("hotfix")) {
		return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
	}

	if (branch.startsWith("release")) {
		return version;
	}

	return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
}

function generateFinalVersionName(version, descriptor, runNumber) {
	return [version, descriptor, runNumber].filter(x => x).join("-");
}

function normalizeBranchName(branchName, trimPrefix) {
	if (trimPrefix) {
		branchName = branchName.substring(branchName.indexOf("/") + 1);
	}
	return branchName.replaceAll("/", "-").toLowerCase();
}
