const core = require('@actions/core');
const github = require('@actions/github');

try {
    var branch;
    var isTag = false;

    console.log(JSON.stringify(github.context));

    switch (github.context.eventName) {
        case "pull_request":
            branch = process.env.GITHUB_REF;
            break;

        case "push":
        default:
            branch = github.context.ref;

            if (branch.startsWith('refs/tags/')) {
                isTag = true;
                branch = branch.replace('refs/tags/', '');
                version = branch.replace('refs/tags/', '');
            }
            else if (branch.startsWith('refs/heads/')) {
                branch = github.context.ref.replace('refs/heads/', '');
            }
    }

    if (!isTag) {
        version = core.getInput('package-version');
        const runNumber = github.context.runNumber;
        const type = core.getInput('type');
        console.log(`Branch ${branch}`);
        console.log(`Version: ${version}`)
        let appVersion;

        switch(type) {
            case 'lib':
                appVersion = generateLibraryVersionString(branch, version, runNumber);
                break;
            case 'deploy':
                appVersion = generateDeployableVersionString(branch, version, runNumber);
                break;
            default:
                throw `'${type}' is not a valid type for this action`;
        }

        core.notice(`App version: ${appVersion}`);
        core.setOutput("app-version", appVersion);
    }
    else {
        core.notice(`App version: ${version}`);
        core.setOutput("app-version", version);
    }
} catch (error) {
    core.setFailed(error.message);
}

function generateLibraryVersionString(branch, version, runNumber) {
    switch(branch) {
        case 'main':
        case 'master':
            return version;
        case 'develop':
            return generateFinalVersionName(version, 'dev', runNumber);
        case branch && branch.startsWith('hotfix'):
            return generateFinalVersionName(version, 'hotfix', runNumber);
        default:
            return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
    }
}

function generateDeployableVersionString(branch, version, runNumber) {
    if (branch === 'main' || branch === 'master') {
        return version;
    }

    if (branch.startsWith('feature')) {
        return generateFinalVersionName(version, "demo-" + normalizeBranchName(branch, true), runNumber);
    }

    if (branch.startsWith('hotfix')) {
        return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);
    }

    if (branch === 'develop') {
        return generateFinalVersionName(version, 'dev', runNumber);
    }

    return generateFinalVersionName(version, normalizeBranchName(branch, false), runNumber);

}

function generateFinalVersionName(version, descriptor, runNumber) {
    return `${version}-${descriptor}-${runNumber}`;
}

function normalizeBranchName(branchName, trimPrefix) {
    if (trimPrefix) {
        branchName = branchName.substring(branchName.indexOf('/') + 1);
    }
    return branchName.replace('/', '-').toLowerCase()
}