#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const rest_1 = require("@octokit/rest");
const llm_evaluator_1 = require("./llm-evaluator");
const program = new commander_1.Command();
program
    .name('action-onlyrobots')
    .description('GitHub Action to ensure code is written by AI agents, not humans')
    .version('1.0.0')
    .requiredOption('--github-token <token>', 'GitHub token for API access')
    .requiredOption('--openai-api-key <key>', 'OpenAI API key for LLM evaluation')
    .requiredOption('--owner <owner>', 'Repository owner')
    .requiredOption('--repo <repo>', 'Repository name')
    .requiredOption('--pr-number <number>', 'Pull request number', parseInt)
    .action(async (options) => {
    const config = {
        githubToken: options.githubToken,
        openaiApiKey: options.openaiApiKey,
        owner: options.owner,
        repo: options.repo,
        prNumber: options.prNumber,
    };
    try {
        await runAction(config);
    }
    catch (error) {
        console.error('❌ Action failed:', error);
        process.exit(1);
    }
});
async function runAction(config) {
    console.log(`🤖 Evaluating PR #${config.prNumber} in ${config.owner}/${config.repo}`);
    // Initialize clients
    const octokit = new rest_1.Octokit({ auth: config.githubToken });
    const evaluator = new llm_evaluator_1.LLMEvaluator({ OPENAI_API_KEY: config.openaiApiKey });
    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
        owner: config.owner,
        repo: config.repo,
        pull_number: config.prNumber,
    });
    // Get changed files
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner: config.owner,
        repo: config.repo,
        pull_number: config.prNumber,
    });
    // Filter and prepare files for evaluation
    const filesToEvaluate = files
        .filter((file) => file.status !== 'removed' && isCodeFile(file.filename))
        .map((file) => ({
        filename: file.filename,
        patch: file.patch || '',
    }))
        .filter((file) => file.patch.length > 0);
    if (filesToEvaluate.length === 0) {
        console.log('✅ No code files to evaluate');
        return;
    }
    console.log(`📁 Evaluating ${filesToEvaluate.length} file(s)...`);
    // Evaluate using LLM
    const evaluation = await evaluator.evaluatePullRequest(filesToEvaluate);
    const { overallResult, fileResults } = evaluation;
    // Create check run
    const checkRunResponse = await octokit.rest.checks.create({
        owner: config.owner,
        repo: config.repo,
        name: 'Only Robots',
        head_sha: pr.head.sha,
        status: 'completed',
        conclusion: overallResult.isHumanLike ? 'failure' : 'success',
        output: {
            title: overallResult.isHumanLike
                ? '❌ Code appears to be human-written'
                : '✅ Code appears to be AI-generated',
            summary: buildSummary(filesToEvaluate.length, overallResult),
            text: buildDetails(overallResult, fileResults),
        },
    });
    // Output results
    if (overallResult.isHumanLike) {
        console.log(`❌ FAILED: Code appears to be human-written (${overallResult.confidence.toFixed(1)}% confidence)`);
        console.log(`📊 Check run: ${checkRunResponse.data.html_url}`);
        process.exit(1);
    }
    else {
        console.log(`✅ PASSED: Code appears to be AI-generated (${overallResult.confidence.toFixed(1)}% confidence)`);
        console.log(`📊 Check run: ${checkRunResponse.data.html_url}`);
    }
}
function buildSummary(fileCount, overallResult) {
    let summary = `Analyzed ${fileCount} file(s) in this pull request.\n\n`;
    summary += `**Overall Assessment:** ${overallResult.reasoning}\n\n`;
    summary += `**Confidence:** ${overallResult.confidence.toFixed(1)}%\n\n`;
    if (overallResult.indicators.length > 0) {
        summary += '**Key Indicators:**\n';
        for (const indicator of overallResult.indicators) {
            summary += `- ${indicator}\n`;
        }
    }
    return summary;
}
function buildDetails(overallResult, fileResults) {
    let details = '';
    if (overallResult.isHumanLike) {
        details += '## Files flagged as potentially human-written:\n\n';
        for (const fileResult of fileResults) {
            if (fileResult.result.isHumanLike) {
                details += `### ${fileResult.filename}\n`;
                details += `**Confidence:** ${fileResult.result.confidence.toFixed(1)}%\n\n`;
                details += `**Reasoning:** ${fileResult.result.reasoning}\n\n`;
                if (fileResult.result.indicators.length > 0) {
                    details += '**Indicators:**\n';
                    for (const indicator of fileResult.result.indicators) {
                        details += `- ${indicator}\n`;
                    }
                    details += '\n';
                }
                details += '---\n\n';
            }
        }
    }
    else {
        details += '## All files appear to be AI-generated 🤖\n\n';
        details +=
            'The code in this PR shows consistent patterns typical of AI-assisted development. Great job maintaining the "only robots" policy!\n\n';
        details += '### File Analysis Summary:\n';
        for (const fileResult of fileResults) {
            details += `- **${fileResult.filename}**: ${fileResult.result.confidence.toFixed(1)}% confidence AI-generated\n`;
        }
    }
    return details;
}
function isCodeFile(filename) {
    const codeExtensions = [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.h',
        '.cs',
        '.rb',
        '.go',
        '.rs',
        '.swift',
        '.kt',
        '.scala',
        '.php',
        '.vue',
        '.svelte',
        '.astro',
    ];
    return codeExtensions.some((ext) => filename.endsWith(ext));
}
if (require.main === module) {
    program.parse();
}
//# sourceMappingURL=cli.js.map