import * as core from '@actions/core';
import * as github from '@actions/github';
import { LLMEvaluator, type FileToEvaluate } from './llm-evaluator';

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const openaiApiKey = core.getInput('openai-api-key', { required: true });
    const prNumber = parseInt(core.getInput('pr-number') || '0');

    if (!prNumber) {
      core.setFailed('No pull request number provided');
      return;
    }

    const { owner, repo } = github.context.repo;

    core.info(`🤖 Evaluating PR #${prNumber} in ${owner}/${repo}`);

    // Initialize clients
    const octokit = github.getOctokit(githubToken);
    const evaluator = new LLMEvaluator({ OPENAI_API_KEY: openaiApiKey });

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get changed files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Filter and prepare files for evaluation
    const filesToEvaluate: FileToEvaluate[] = files
      .filter((file) => file.status !== 'removed' && isCodeFile(file.filename))
      .map((file) => ({
        filename: file.filename,
        patch: file.patch || '',
      }))
      .filter((file) => file.patch.length > 0);

    if (filesToEvaluate.length === 0) {
      core.info('✅ No code files to evaluate');
      core.setOutput('result', 'passed');
      core.setOutput('confidence', '100');
      core.setOutput('summary', 'No code files to evaluate');
      return;
    }

    core.info(`📁 Evaluating ${filesToEvaluate.length} file(s)...`);

    // Evaluate using LLM
    const evaluation = await evaluator.evaluatePullRequest(filesToEvaluate);
    const { overallResult, fileResults } = evaluation;

    // Create check run
    await octokit.rest.checks.create({
      owner,
      repo,
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

    // Set outputs
    core.setOutput('result', overallResult.isHumanLike ? 'failed' : 'passed');
    core.setOutput('confidence', overallResult.confidence.toFixed(1));
    core.setOutput('summary', overallResult.reasoning);

    // Output results
    if (overallResult.isHumanLike) {
      core.setFailed(
        `Code appears to be human-written (${overallResult.confidence.toFixed(1)}% confidence)`
      );
    } else {
      core.info(
        `✅ Code appears to be AI-generated (${overallResult.confidence.toFixed(1)}% confidence)`
      );
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildSummary(fileCount: number, overallResult: any): string {
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

function buildDetails(overallResult: any, fileResults: any[]): string {
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
  } else {
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

function isCodeFile(filename: string): boolean {
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
  run();
}
