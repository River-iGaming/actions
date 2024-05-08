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
    console.log(`Package Version: ${packageVersion}`)
    console.log(`Version: ${version}`)

    if (!(branch && packageVersion && version)) {
        throw "Branch, package version and version are required";
    }

    const tags = execSync("git ls-remote --tags").toString().split("\n").filter(x => x).map(x => x.split("\t")[1]);
    const exactVersionTag = tags.find(x => x === `refs/tags/${version}`);

    if (exactVersionTag) {
        throw `Tag v${version} already exists`;
    }

    const isReleaseBranch = branch.startsWith("release");
    const coreVersionTagMatch = tags.find(x => x.indexOf(packageVersion) > -1);
    const lastComment = Object.values(github.context.payload.commits).sort((a, b) => a.timestamp < b.timestamp ? 0 : -1)[0]?.message;

    console.log(`Last comment: ${lastComment}`);
    console.log(`Core version tag matched: ${coreVersionTagMatch}`);

    const isReleaseBranchMerge = checkReleaseBranchMerge(lastComment, branch);
    if (isVersionAlteredInNonReleaseBranch(isReleaseBranch, coreVersionTagMatch) && !isReleaseBranchMerge) {
        throw `Version was altered in a non release branch`;
    }

    if (isReleaseBranchMerge) {
        console.log(`Release branch merge detected. Checking for valid version...`);

        const semVersion = semver.parse(version);
        const lastVersionTag = tags[tags.length - 1].replace("refs/tags/", "")
        const lastVersionFromTags = semver.parse(lastVersionTag);

        if (semVersion.minor <= lastVersionFromTags.minor || semver.gt(lastVersionFromTags, semVersion)) {
            throw `Version is smaller than the previous version`;
        }
    }

} catch (error) {
    core.setFailed(error);
}

function isVersionAlteredInNonReleaseBranch(isReleaseBranch, coreVersionTagMatch) {
    return !isReleaseBranch && !coreVersionTagMatch;
}

function checkReleaseBranchMerge(lastComment, branch) {
    const isLastCommentMerge = lastComment?.indexOf(`chore(*): merge release/MW-`) > -1;

    // const pullRequest = github.context.payload.pull_request;
    // if(!pullRequest){
    //     return isLastCommentMerge || branch.startsWith("merge/");
    // }    

    console.log(`Merge detected:\n${JSON.stringify(github.context.payload.commits[0])}`);

    const mergeCommits = github.context.payload.commits[0]?.incomingBranchName;
    if(!mergeCommits){
        return isLastCommentMerge || branch.startsWith("merge/");
    }

    const isMerge = pullRequest.merged;
    const incomingBranchName = pullRequest.head.ref.replace("refs/heads/", "");
    return isLastCommentMerge || (isMerge && incomingBranchName.startsWith("merge/"));   
}