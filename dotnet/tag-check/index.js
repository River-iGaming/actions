const core = require("@actions/core");
const github = require("@actions/github");

try {
    const branch = github.context.ref.replace("refs/heads/", "");
    const packageVersion = core.getInput("package-version");
    const version = core.getInput("app-version");
    const runNumber = github.context.runNumber;
    console.log(`Branch: ${branch}`);
    console.log(`Package Version: ${packageVersion}`)
    console.log(`Version: ${version}`)

    const tags = github.tags;  //execSync("git ls-remote --tags origin").toString().split("\n").filter(x => x);
    const exactVersionTag = tags.find(x => x === `refs/tags/v${version}`);
    if (exactVersionTag) {
        throw `Tag v${version} already exists`;
    }

    const isRelease = branch.startsWith("release");
    const coreVersionTag = tags.find(x => x.indexOf(`v${packageVersion}`) > -1);
    const lastComment = github.context.context.payload.commits[0].message;

    if(!isRelease && !coreVersionTag && lastComment.indexOf(`merge release MW-`) === -1) {
        throw `Version was altered  in a non release branch`;
    }

    // core.notice(`App version: ${appVersion}`);
    // core.setOutput("app-version", appVersion);
} catch (error) {
    core.setFailed(error.message);
}