const core = require("@actions/core");
const github = require("@actions/github");

try {
	const branch = github.context.ref.replace("refs/heads/", "");
	const version = core.getInput("package-version");
	const runNumber = github.context.runNumber;
	const type = core.getInput("type");
	console.log(`Branch ${branch}`);
	console.log(`Version: ${version}`);
	let appVersion;

	// switch is really redundant here, but leaving it here in case we need to separate logic
	switch (type) {
		case "lib":
			appVersion = generateVersionString(branch, version, runNumber);
			break;
		case "deploy":
			appVersion = generateVersionString(branch, version, runNumber);
			break;
		default:
			throw `'${type}' is not a valid type for this action`;
	}

	core.notice(`App version: ${appVersion}`);
	core.setOutput("app-version", appVersion);
} catch (error) {
	core.setFailed(error);
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
	return branchName.replace("/", "-").toLowerCase();
}
