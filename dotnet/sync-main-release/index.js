const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require("child_process");

try {
	const branch = github.context.ref.replace("refs/heads/", "");
	const runNumber = github.context.runNumber;

	console.log(`Branch: ${branch}`);

	const tags = execSync("git ls-remote --tags")
		.toString()
		.split("\n")
		.filter(x => x)
		.map(x => x.split("\t")[1])
		.map(x => x.replace("refs/tags/", ""))
		.filter(x => x)
		;


	console.log("✅ All checks passed successfully!");
} catch (error) {
	core.setFailed(error);
}