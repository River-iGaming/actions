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

	const isReleaseBranch = branch.startsWith("release");
	const coreVersionTagMatch = tags.find(x => x.indexOf(packageVersion) > -1);
	const lastComment = Object.values(github.context.payload.commits).sort((a, b) =>
		a.timestamp < b.timestamp ? 0 : -1,
	)[0]?.message;

	console.log("commits: "+ JSON.stringify(github.context.payload.commits));

	console.log(`Last comment: ${lastComment}`);
	console.log(`Core version tag matched: ${coreVersionTagMatch}`);

	const isReleaseBranchMerge = checkMergeFromReleaseBranch(lastComment, branch);
	if (isVersionAlteredInNonReleaseBranch(isReleaseBranch, coreVersionTagMatch) && !isReleaseBranchMerge) {
		throw `Version was altered in a non release branch`;
	}

	if (isReleaseBranchMerge) {
		console.log(`Release branch merge detected. Checking for valid version...`);

		const semVersion = semver.parse(version);
		const lastVersionTag = getLastVersionFromTags(tags);

		console.log(`Last version tag: ${lastVersionTag}`);

		if(tags.length > 0 && !lastVersionTag){
			throw `No semver version found in tags`;
		}

		if (tags.length > 0 && lastVersionTag.prerelease.length == 0 && lastVersionTag.compareMain(semVersion) == 1){
			throw `Version is smaller than the previous version`;
		}
	}
} catch (error) {
	core.setFailed(error);
}

function isVersionAlteredInNonReleaseBranch(isReleaseBranch, coreVersionTagMatch) {
	return !isReleaseBranch && !coreVersionTagMatch && github.context.payload.commits[0].committer.username !== "web-flow";
}

function checkMergeFromReleaseBranch(lastComment, branch) {
	const isLastCommentMerge =
		["chore(*): merge release/MW-", "chore(*): version bump manual intervention", "version bump"]
			.map(x => lastComment?.indexOf(x) > -1)
			.filter(x => x).length > 0;
	console.log("Is last comment merge: ", isLastCommentMerge);

	return isLastCommentMerge || branch.startsWith("merge/") || branch.startsWith("hotfix/");
}

function getLastVersionFromTags(tags) {
	let tagFound = undefined;
	for (let i = tags.length - 1; i >= 0; i--) {
		const semvered = semver.parse(tags[i]);
		if (semvered) {
			tagFound = semvered;
			break;
		}
	}

	return tagFound;
}
