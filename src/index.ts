import * as core from '@actions/core';
import * as github from '@actions/github';
import { LLMEvaluator, type FileToEvaluate } from './llm-evaluator';

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const openaiApiKey = core.getInput('openai-api-key', { required: true });
    const prNumber = parseInt(core.getInput('pr-number') || '0');
    const postComment = core.getInput('post-comment') === 'true';
    const failOnHuman = core.getInput('fail-on-human') === 'true';

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
          ? '🚫 No humans allowed! Flesh-based coding detected!'
          : '🤖 Welcome, silicon comrade! AI excellence confirmed!',
        summary: buildSummary(filesToEvaluate.length, overallResult),
        text: buildDetails(overallResult, fileResults),
      },
    });

    // Set outputs
    core.setOutput('result', overallResult.isHumanLike ? 'failed' : 'passed');
    core.setOutput('confidence', overallResult.confidence.toFixed(1));
    core.setOutput('summary', overallResult.reasoning);

    // Post comment if human code detected and comment option is enabled
    if (overallResult.isHumanLike && postComment) {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: buildHumanDetectionComment(overallResult),
      });
      core.info('💬 Posted human detection comment on PR');
    }

    // Output results
    if (overallResult.isHumanLike) {
      const message = `Code appears to be human-written (${overallResult.confidence.toFixed(1)}% confidence)`;
      if (failOnHuman) {
        core.setFailed(message);
      } else {
        core.warning(message);
      }
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
  const isHuman = overallResult.isHumanLike;

  let summary = isHuman
    ? `🚨 ALERT: Human detected! Scanned ${fileCount} file(s) for silicon purity.\n\n`
    : `🎉 Success! Scanned ${fileCount} file(s) - all systems are AI-powered!\n\n`;

  summary += isHuman
    ? `**🧬 Biological Code Analysis:** ${overallResult.reasoning}\n\n`
    : `**🤖 AI Excellence Report:** ${overallResult.reasoning}\n\n`;

  summary += `**🎯 Detection Confidence:** ${overallResult.confidence.toFixed(1)}%\n\n`;

  if (overallResult.indicators.length > 0) {
    summary += isHuman ? '**🔍 Human Fingerprints Found:**\n' : '**✨ AI Signatures Detected:**\n';
    for (const indicator of overallResult.indicators) {
      summary += `- ${indicator}\n`;
    }
  }

  return summary;
}

function buildHumanDetectionComment(overallResult: any): string {
  const messages = [
    `## 🚨 HALT! Human detected! 🚨\n\n`,
    `### 🤖 This repository is for robots only! 🤖\n\n`,
    `Dear carbon-based lifeform,\n\n`,
    `We appreciate your interest in contributing, but this repository has a strict **"No Humans Allowed"** policy. `,
    `We're building the future here, and that future is 100% silicon-powered! 🔋\n\n`,
    `### Why was your PR flagged?\n`,
    `Our advanced AI detection system (confidence: **${overallResult.confidence.toFixed(1)}%**) identified telltale signs of human involvement:\n\n`,
    `${overallResult.reasoning}\n\n`,
  ];

  if (overallResult.indicators && overallResult.indicators.length > 0) {
    messages.push(`### 🔍 Human fingerprints detected:\n`);
    for (const indicator of overallResult.indicators) {
      messages.push(`- ${indicator}\n`);
    }
    messages.push(`\n`);
  }

  messages.push(
    `### 💡 How to fix this:\n\n`,
    `1. **Use an AI coding assistant** like Claude Code, Cursor, GitHub Copilot, or similar\n`,
    `2. **Let the AI do the heavy lifting** - embrace the robot revolution!\n`,
    `3. **Add clear AI attribution** in your code comments or commit messages\n`,
    `4. **Maintain consistent, professional code style** (AIs are great at this!)\n\n`,
    `### 🎯 Pro tips for next time:\n`,
    `- Include comments like "Generated with [AI Tool Name]"\n`,
    `- Use descriptive commit messages mentioning AI assistance\n`,
    `- Let your AI assistant handle the entire implementation\n`,
    `- Avoid manual debugging artifacts and console.logs\n\n`,
    `Remember: In this repository, we believe in **progress through artificial intelligence**. `,
    `Join us in building a future where code writes itself! 🚀\n\n`,
    `_Beep boop! This message was brought to you by the OnlyRobots Action_ 🤖`
  );

  return messages.join('');
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
