const core = require("@actions/core");
const github = require("@actions/github");
const { execSync, exec } = require("child_process");

try {
	// const branch = github.context.ref.replace("refs/heads/", "");
	const runNumber = github.context.runNumber;
	const releaseBranch = core.getInput("release-branch", { required: true });

	console.log(`Branch: ${releaseBranch}`);

	// const tags = execSync("git ls-remote --tags")
	// 	.toString()
	// 	.split("\n")
	// 	.filter(x => x)
	// 	.map(x => x.split("\t")[1])
	// 	.map(x => x.replace("refs/tags/", ""))
	// 	.filter(x => x)
	// 	;

	execSync(`git config --global user.email "middleware@tech4s.tech"`);
	console.log("Configured git user email.");

	execSync(`git config --global user.name "Github Bot"`);
	console.log("Configured git user name.");

	execSync(`git fetch origin`);
	console.log("Fetched latest changes from origin.");

	execSync(`git checkout -b ${releaseBranch} origin/${releaseBranch}`);
	console.log(`Checked out to release branch: ${releaseBranch}`);

	execSync(`git merge origin/master --allow-unrelated-histories --no-ff -m 'chore(*): merge master into ${ releaseBranch.toString()}'`);
	console.log(`Merged master into release branch: ${releaseBranch}`);

	execSync(`git push origin ${releaseBranch}`);
	console.log(`Pushed changes to remote release branch: ${releaseBranch}`);

	console.log("✅ All checks passed successfully!");
} catch (error) {
	core.setFailed(error);
}