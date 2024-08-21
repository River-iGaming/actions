const core = require("@actions/core");
const github = require("@actions/github");

try {
	const version = core.getInput("package-version", { required: true });
	const type = core.getInput("type", { required: true });
	const branch = github.context.ref.replace("refs/heads/", "");
	const runNumber = github.context.runNumber;

	console.log(`Branch ${branch}`);
	console.log(`Version: ${version}`);
	let buildVersion;

	switch (type) {
		case "lib":
			buildVersion = generateLibraryVersionString(branch, version, runNumber);
			break;
		case "dotnet-app":
		case "deploy": // todo: deprecate remove
			if (type === "deploy") {
				core.warning("The 'deploy' type is deprecated. Please use 'dotnet-app' instead.");
			}
			buildVersion = generateMwAppVersionString(branch, version, runNumber);
			break;
		case "fe-app":
			buildVersion = generateFeAppVersionString(branch, version, runNumber);
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
	core.setOutput("app-version", buildVersion); // todo: deprecated remove
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
	return branchName.replaceAll("/", "-").toLowerCase();
}
