const core = require('@actions/core');
const github = require('@actions/github');

try {
    const branch = github.context.ref.replace('refs/heads/', '');
    const version = core.getInput('package-version');
    const runNumber = github.context.runNumber;
    console.log(`Branch ${branch}`);
    console.log(`Version: ${version}`)

    var appVersion;

    switch(branch) {
        case 'main':
        case 'master':
            appVersion = version;
            break;
        case 'develop':
            appVersion = `${version}-dev-${runNumber}`;
            break;
        case branch && branch.startsWith('hotfix'):
            appVersion = `${version}-hotfix-${runNumber}`;
            break;
        default:
            appVersion = `${version}-${branch.replace('/', '-')}-${runNumber}`;
    }

    core.notice(`App version: ${appVersion}`);

    core.setOutput("app-version", appVersion);
} catch (error) {
    core.setFailed(error.message);
}