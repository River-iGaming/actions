const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const semver = require("semver");
const fs = require('fs');


async function run() {
	try {
		// Get inputs
		const sourceBranch = core.getInput('source-branch', { required: true });
		const targetBranch = core.getInput('target-branch', { required: true });
		const conflictAutoKeepFiles = core.getInput('conflict-auto-keep-files') || 'package.json';
		const includeCommit = core.getInput('include-commit') || 'true';
		const githubToken = core.getInput('github-token', { required: true });

		// const sourceBranch = "master";
		// const targetBranch = "release/test-s"
		// const conflictAutoKeepFiles = "package.json\nREADME.md";
		// const includeCommit = true;
		// const githubToken = "";

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
			await exec.exec('git', ['merge', '--no-commit', '--no-ff', '--no-edit', "--allow-unrelated-histories", sourceBranch]);

			// Check if there are changes to commit
			const { stdout: statusOutput } = await exec.getExecOutput('git', ['status', '--porcelain']);
			if (!statusOutput.trim()) {
				core.notice(`Nothing to commit for branch: ${targetBranch}`);
			}
		} catch (error) {
			// Handle merge conflicts
			const { stdout: conflictsOutput } = await exec.getExecOutput('git', ['diff', '--name-only', '--diff-filter=U']);
			const conflicts = conflictsOutput.trim().split('\n').filter(line => line.trim());
			const { autoResolvable, needsUserInput, hasConflicts } = analyzeConflicts(conflicts);

			core.warning(`Conflicts: ${conflicts.join(', ')}`);
			if (needsUserInput.filter(x => !x.includes('package.json')).length > 0) {
				core.error(`❌ The following files require manual resolution: ${needsUserInput.join(', ')}`);
				core.setOutput('needs-user-input', needsUserInput.join(', '));
				mergeFailed = true;

				throw "Merge failed due to unresolved conflicts. Please resolve them manually.";
			};

			// Parse auto-keep files
			const autoKeepFiles = conflictAutoKeepFiles
				.split(',')
				.map(file => file.trim())
				.filter(file => file.length > 0);

			for (const conflictFile of conflicts) {
				const isAutoKeepFile = autoKeepFiles.includes(conflictFile);

				if (autoResolvable.includes(conflictFile)) {
					core.notice(`⚠️ Auto-resolving ${conflictFile} version conflicts.`);
					await exec.exec('git', ['checkout', '--ours', conflictFile]);
					await exec.exec('git', ['add', conflictFile]);

					continue;
				}

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
		if (includeCommit.toString().toLowerCase() === "true" && !mergeFailed) {
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
		throw error;
	}

	function analyzeConflicts(conflictedFiles) {
		try {
			if (conflictedFiles.length === 0) {
				return { autoResolvable: [], needsUserInput: [], hasConflicts: false };
			}

			const autoResolvable = [];
			const needsUserInput = [];

			conflictedFiles.forEach(file => {
				try {
					// Check if file has conflict markers
					const hasConflictMarkers = execSync(`grep -c "^<<<<<<< " "${file}" 2>/dev/null || echo "0"`, { encoding: 'utf8' }).trim();

					if (parseInt(hasConflictMarkers) === 0) {
						autoResolvable.push(file);
					} else {
						// Analyze conflict complexity
						const conflictBlocks = execSync(`grep -c "^=======" "${file}" 2>/dev/null || echo "0"`, { encoding: 'utf8' }).trim();

						if (parseInt(conflictBlocks) === 1 && isSimpleConflict(file)) {
							autoResolvable.push(file);
						} else {
							needsUserInput.push(file);
						}
					}
				} catch (error) {
					// If we can't analyze the file, treat it as needing user input
					needsUserInput.push(file);
				}
			});

			return { autoResolvable, needsUserInput, hasConflicts: true };
		} catch (error) {
			return { autoResolvable: [], needsUserInput: [], hasConflicts: false };
		}
	}

	function isSimpleConflict(file) {
		try {
			// Check if it's a simple whitespace or non-overlapping change
			const diffOutput = execSync(`git diff "${file}"`, { encoding: 'utf8' });

			// Simple heuristics
			const lines = diffOutput.split('\n');
			const hasOnlyWhitespace = lines.every(line =>
				!line.startsWith('+') && !line.startsWith('-') || /^[+-]\s*$/.test(line)
			);
			const isSmallChange = lines.length < 10;

			return hasOnlyWhitespace || isSmallChange;
		} catch (error) {
			return false;
		}
	}
}

run().catch(error => {
 core.setFailed(`Action failed with error: ${error.message}`);
});