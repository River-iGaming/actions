const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const semver = require("semver");


async function run() {
	try {
		// Get inputs
		const sourceBranch = core.getInput('source-branch', { required: true });
		const targetBranch = core.getInput('target-branch', { required: true });
		const conflictAutoKeepFiles = core.getInput('conflict-auto-keep-files') || 'package.json';
		const includeCommit = core.getInput('include-commit') || 'true';
		const githubToken = core.getInput('github-token', { required: true });

		let mergeFailed = false;
		let autoResolved = false;

		// Configure git
		await exec.exec('git', ['config', 'user.email', 'deploy-bot@riverigaming.com']);
		await exec.exec('git', ['config', 'user.name', 'rig-autobot']);
		await exec.exec('git', ['fetch', '--all']);
		await exec.exec('git', ['checkout', targetBranch]);

		core.notice(`Merging branch: ${sourceBranch} into: ${targetBranch}`);

		try {
			// Attempt merge
			await exec.exec('git', ['merge', '--no-commit', '--no-ff', '--no-edit', sourceBranch]);

			// Check if there are changes to commit
			const { stdout: statusOutput } = await exec.getExecOutput('git', ['status', '--porcelain']);
			if (!statusOutput.trim()) {
				core.notice(`Nothing to commit for branch: ${targetBranch}`);
			}
		} catch (error) {
			// Handle merge conflicts
			const { stdout: conflictsOutput } = await exec.getExecOutput('git', ['diff', '--name-only', '--diff-filter=U']);
			const conflicts = conflictsOutput.trim().split('\n').filter(line => line.trim());

			core.warning(`Conflicts: ${conflicts.join(', ')}`);

			// Parse auto-keep files
			const autoKeepFiles = conflictAutoKeepFiles
				.split('\n')
				.map(file => file.trim())
				.filter(file => file.length > 0);

			for (const conflictFile of conflicts) {
				const isAutoKeepFile = autoKeepFiles.includes(conflictFile);

				if (isAutoKeepFile) {
					core.notice(`⚠️ Auto-resolving ${conflictFile} version conflicts.`);

					// Special handling for package.json - bump minor version
					if (conflictFile === 'package.json') {
						try {
							// Get the current version from our branch (--ours)
							await exec.exec('git', ['checkout', '--ours', conflictFile]);

							// Read and parse package.json
							const packageJsonContent = fs.readFileSync(conflictFile, 'utf8');
							const packageJson = JSON.parse(packageJsonContent);

							// Bump minor version
							if (packageJson.version) {
								const currentVersion = packageJson.version;
								const newVersion = semver.inc(currentVersion, 'minor');
								packageJson.version = newVersion;

								core.notice(`📦 Bumping ${conflictFile} version from ${currentVersion} to ${newVersion}`);

								// Write back the updated package.json
								fs.writeFileSync(conflictFile, JSON.stringify(packageJson, null, 2) + '\n');
							}
						} catch (versionError) {
							core.warning(`Failed to bump version in ${conflictFile}: ${versionError.message}`);
							// Fall back to just keeping our version
							await exec.exec('git', ['checkout', '--ours', conflictFile]);
						}
					} else {
						// For other auto-keep files, just keep our version
						await exec.exec('git', ['checkout', '--ours', conflictFile]);
					}

					await exec.exec('git', ['add', conflictFile]);
					autoResolved = true;
				} else {
					core.error(`❌ Conflict in ${conflictFile} cannot be auto-resolved. Aborting merge.`);
					mergeFailed = true;
					break;
				}
			}
		}

		// Set outputs
		core.setOutput('merge-failed', mergeFailed.toString());
		core.setOutput('auto-resolved', autoResolved.toString());

		// Commit and push if requested and merge didn't fail
		if (includeCommit === 'true' && !mergeFailed) {
			const { stdout: statusOutput } = await exec.getExecOutput('git', ['status', '--porcelain']);

			if (statusOutput.trim()) {
				if (autoResolved) {
					core.notice(`⚠️ Conflicts auto-resolved, commit and push: ${targetBranch}`);
					await exec.exec('git', ['commit', '-m', 'chore(*): auto-resolve version conflicts']);
				} else {
					core.notice(`✅ Commit and push to: ${targetBranch}`);
					await exec.exec('git', ['commit', '-m', `chore(*): merged ${sourceBranch} into ${targetBranch}`]);
				}
				await exec.exec('git', ['push', 'origin', '-f', targetBranch]);
			}
		}

	} catch (error) {
		core.setFailed(error.message);
	}
}

run();