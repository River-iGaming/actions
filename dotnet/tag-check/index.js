const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require('child_process');

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
    console.log(tags);

    const exactVersionTag = tags.find(x => x === `refs/tags/${version}`);

    if (exactVersionTag) {
        throw `Tag v${version} already exists`;
    }

    const isReleaseBranch  = branch.startsWith("release");
    const coreVersionTagMatch = tags.find(x => x.indexOf(packageVersion) > -1);
    const lastComment = Object.values(github.context.payload.commits).sort((a, b) => a.timestamp < b.timestamp ? 0 : -1)[0].message;
    console.log(Object.values(github.context.payload.commits).sort((a, b) => a.timestamp < b.timestamp ? 0 : -1));

    console.log(`Last comment: ${lastComment}`);
    console.log(`Core version tag matched: ${coreVersionTagMatch}`);

    if (!isReleaseBranch && !coreVersionTagMatch && lastComment?.indexOf(`chore(*): merge release/MW-`) === -1) {
        throw `Version was altered in a non release branch`;
    }

    // core.notice(`App version: ${appVersion}`);
    // core.setOutput("app-version", appVersion);
} catch (error) {
    core.setFailed(error);
}