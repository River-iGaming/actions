const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require("child_process");
const semver = require("semver");

try {
	const branch = github.context.ref.replace("refs/heads/", "");
	const packageVersion = core.getInput("package-version");
	const version = core.getInput("app-version");
	const runNumber = github.context.runNumber;

	console.log(`Branch: ${branch}`);
	console.log(`Package Version: ${packageVersion}`);
	console.log(`Version: ${version}`);

	if (!(branch && packageVersion && version)) {
		throw "`branch`, `packageVersion` and `version` are required";
	}

	const tags = execSync("git ls-remote --tags")
		.toString()
		.split("\n")
		.filter(x => x)
		.map(x => x.split("\t")[1])
		.map(x => x.replace("refs/tags/", ""))
		.filter(x => x)
		;

	const exactVersionTag = tags.find(x => x === `${version}`);
	if (exactVersionTag) {
		throw `Tag v${version} already exists`;
	}

	const isVersionAlterableBranchBranch = branch.startsWith("release") || branch.startsWith("master");
	const coreVersionTagMatch = tags.find(x => x.indexOf(packageVersion) > -1);
	const lastStableVersionTagMatch = getLastStableVersionFromTags(tags);

	const lastComment = Object.values(github.context.payload.commits).sort((a, b) =>
		a.timestamp < b.timestamp ? 0 : -1,
	)[0]?.message;

	console.log(`Last comment: ${lastComment}`);
	console.log(`Core version tag matched: ${coreVersionTagMatch}`);
	console.log(`Latest stable version tag matched: ${lastStableVersionTagMatch}`);

	const isVersionCheckOverride = checkMergeFromReleaseBranch(lastComment, branch);
	if (isVersionCheckOverride) {
		console.log("✅ All checks passed successfully!");
		return;
	}

	if(!isVersionAlterableBranchBranch && !coreVersionTagMatch) {
		throw `Version ${version} was altered in a non-version alterable branch. This can only be done in release branches.`;
	}

	if (isVersionAlterableBranchBranch) {
		const versionDiff = semver.diff(lastStableVersionTagMatch, version);
		const isGreater = semver.gt(version, lastStableVersionTagMatch);

		if (!isGreater || (versionDiff !== "patch" && versionDiff !== "minor" && versionDiff !== "major")) {
			throw `Version ${version} is smaller than the current released version ${lastStableVersionTagMatch}`;
		}
	}

	console.log("✅ All checks passed successfully!");
} catch (error) {
	core.setFailed(error);
}

function isVersionAlteredInNonReleasableBranch(isReleasableBranch, coreVersionTagMatch) {
	// non-releasable branches are: master, main
	return !isReleasableBranch && !coreVersionTagMatch && github.context.payload.commits[0].committer.username !== "web-flow";
}

function checkMergeFromReleaseBranch(lastComment, branch) {
	const isLastCommentMerge =
		["chore(*): merge release/", "chore(*): version bump manual intervention", "version bump"]
			.map(x => lastComment?.indexOf(x) > -1)
			.filter(x => x).length > 0;

	return isLastCommentMerge || branch.startsWith("merge/") || branch.startsWith("hotfix/");
}

function getLastStableVersionFromTags(tags) {
	const stableTags = tags.filter(x => semver.parse(x)?.prerelease.length === 0);
	const tagFound = semver.rsort(stableTags)[0];
	return tagFound;
}
