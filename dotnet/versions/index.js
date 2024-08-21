const core = require("@actions/core");
const github = require("@actions/github");

try {
	const branch = github.context.ref.replace("refs/heads/", "");
	const version = core.getInput("package-version", { required: true });
	const runNumber = github.context.runNumber;
	const type = core.getInput("type", { required: true });
	console.log(`Branch ${branch}`);
	console.log(`Version: ${version}`);
	let appVersion;

	switch (type) {
		case "lib":
			appVersion = generateLibraryVersionString(branch, version, runNumber);
			break;
		case "dotnet-app":
		case "deploy": // todo: deprecate remove
			if (type === "deploy") {
				core.warning("The 'deploy' type is deprecated. Please use 'dotnet-app' instead.");
			}
			appVersion = generateMwAppVersionString(branch, version, runNumber);
			break;
		case "fe-app":
			appVersion = generateFeAppVersionString(branch, version, runNumber);
			break;
		default:
			throw Error(`'${type}' is not a valid type for this action.`);
	}

	core.notice(`App version: ${appVersion}`);
	core.setOutput("app-version", appVersion);
} catch (error) {
	if (error instanceof Error) {
		core.setFailed(error.message);
	} else {
		core.setFailed(`An unexpected error occurred. Error: ${error}`);
	}
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
