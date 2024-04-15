const core = require('@actions/core');
const github = require('@actions/github');

try {
    const branch = github.context.ref.replace('refs/heads/', '');
    const version = core.getInput('package-version');
    const runNumber = github.context.runNumber;
    const type = core.getInput('type');
    console.log(`Branch: ${branch}`);
    console.log(`Version: ${version}`)

    const tag = github.context.ref.replace('refs/tags/', '');
    console.log(`Tag: ${tag}`);

    core.notice(`App version: ${appVersion}`);
    core.setOutput("app-version", appVersion);
} catch (error) {
    core.setFailed(error.message);
}