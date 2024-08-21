const core = require("@actions/core");
const github = require("@actions/github");

try {
	const branch = github.context.ref.replace("refs/heads/", "");
	const version = core.getInput("package-version");
	const runNumber = github.context.runNumber;
	const type = core.getInput("type");
	console.log(`Branch ${branch}`);
	console.log(`Version: ${version}`);
	console.log(`RunId: ${github.context.runId}`);
	console.log(`RunAttempt: ${github.context.runAttempt}`);
	console.log(`RunAttempt2: ${parseInt(process.env.GITHUB_RUN_ATTEMPT, 10)}`);
	let appVersion;

	switch (type) {
		case "lib":
			appVersion = generateLibraryVersionString(branch, version, runNumber);
			break;
		case "mw-app":
		case "deploy": // todo: deprecate remove
			appVersion = generateMwAppVersionString(branch, version, runNumber);
			break;
		case "fe-app":
			appVersion = generateFeAppVersionString(branch, version, runNumber);
			break;
		default:
			core.error(`'${type}' is not a valid type for this action`);
			throw Error(`'${type}' is not a valid type for this action`);
	}

	core.notice(`App version: ${appVersion}`);
	core.setOutput("app-version", appVersion);
} catch (error) {
	core.setFailed(error.message);
}

function generateLibraryVersionString(branch, version, runNumber) {
	if (branch && branch.startsWith("release")) {
		return generateFinalVersionName(version, normalizeBranchName(branch, true), runNumber);
	}

	switch (branch) {
		case "main":
		case "master":
			return version;
		case "develop":
			return generateFinalVersionName(version, "dev", runNumber);
		default:
			return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
	}
}

function generateMwAppVersionString(branch, version, runNumber) {
	if (branch === "main" || branch === "master") {
		return version;
	}

	if (branch === "develop") {
		return generateFinalVersionName(version, "dev", runNumber);
	}

	if (branch === "vnext") {
		return generateFinalVersionName(version, "vnext", runNumber);
	}

	if (branch.startsWith("feature")) {
		return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
	}

	if (branch.startsWith("hotfix")) {
		return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
	}

	if (branch.startsWith("release")) {
		return generateFinalVersionName(version, normalizeBranchName(branch, true), runNumber);
	}

	return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
}

function generateFeAppVersionString(branch, version, runNumber) {
	if (branch === "main" || branch === "master") {
		return version;
	}

	if (branch === "develop") {
		return generateFinalVersionName(version, "dev", runNumber);
	}

	if (branch === "vnext") {
		return generateFinalVersionName(version, "vnext", runNumber);
	}

	if (branch.startsWith("feature")) {
		return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
	}

	if (branch.startsWith("hotfix")) {
		return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
	}

	if (branch.startsWith("release")) {
		return generateFinalVersionName(version, "release", runNumber);
	}

	return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
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
