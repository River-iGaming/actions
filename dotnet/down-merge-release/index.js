const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require("child_process");
const semver = require("semver");
const fs = require("fs");

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

	execSync("git fetch origin");
	execSync("git checkout master");
	execSync("git pull origin master");
	execSync(`git merge ${branch}`);

	const packageFile = require("./package.json");
	console.log(packageFile);

	if (semver.parse(packageFile.version) <= semver.parse(packageVersion)) {
		packageFile.version = semver.inc(packageFile.version, "minor");

		console.log(`Updating package version to ${packageFile.version}`);

		fs.writeFile("./package.json", JSON.stringify(packageFile, null, 4));
		execSync("git add package.json");
	}

	console.log("Committing changes");

	execSync(`git commit -m "chore(*): merge ${branch}"`);
	execSync("git push origin master");
} catch (error) {
	core.setFailed(error);
}
