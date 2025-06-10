const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require("child_process");

try {
	// const branch = github.context.ref.replace("refs/heads/", "");
	const runNumber = github.context.runNumber;
	const releaseBranch = github.core.getInput("release-branch", { required: true });


	console.log(`Branch: ${branch}`);

	const tags = execSync("git ls-remote --tags")
		.toString()
		.split("\n")
		.filter(x => x)
		.map(x => x.split("\t")[1])
		.map(x => x.replace("refs/tags/", ""))
		.filter(x => x)
		;

	execSync(`git checkout ${releaseBranch}`);
	console.log(`Checked out to release branch: ${releaseBranch}`);

	execSync(`git merge origin/master --no-ff -m "chore(*): merge master into ${{ releaseBranch }}`);
	console.log(`Merged master into release branch: ${releaseBranch}`);

	execSync(`git push origin ${releaseBranch}`);
	console.log(`Pushed changes to remote release branch: ${releaseBranch}`);

	console.log("✅ All checks passed successfully!");
} catch (error) {
	core.setFailed(error);
}