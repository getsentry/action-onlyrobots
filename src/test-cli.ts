#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { LLMEvaluator } from './llm-evaluator';
import { GitHubClient } from './github';
import { config } from 'dotenv';

// Load environment variables
config();

interface CLIOptions {
  help?: boolean;
  format?: 'text' | 'json';
  'github-token'?: string;
  'openai-key'?: string;
  verbose?: boolean;
  'show-diffs'?: boolean;
}

interface PRReference {
  owner: string;
  repo: string;
  number: number;
}

function showHelp() {
  console.log(`
Usage: pnpm run test-pr <pr-url-or-reference> [options]

Examples:
  pnpm run test-pr https://github.com/getsentry/sentry-mcp/pull/394
  pnpm run test-pr getsentry/sentry-mcp#394
  pnpm run test-pr getsentry/sentry-mcp#394 --format json

Options:
  --help              Show this help message
  --format <format>   Output format: text (default) or json
  --github-token      GitHub token for API access (or set GITHUB_TOKEN env var)
  --openai-key        OpenAI API key (or set OPENAI_API_KEY env var)
  --verbose           Show detailed analysis for each file
  --show-diffs        Show the actual code diffs being analyzed

Environment Variables:
  GITHUB_TOKEN        GitHub token for API access
  OPENAI_API_KEY      OpenAI API key (required)
  GITHUB_WEBHOOK_SECRET  GitHub webhook secret (not needed for CLI)
`);
}

function parsePRReference(input: string): PRReference {
  // Handle GitHub URLs
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      number: parseInt(urlMatch[3]),
    };
  }

  // Handle shorthand format: owner/repo#number
  const shortMatch = input.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      number: parseInt(shortMatch[3]),
    };
  }

  throw new Error(`Invalid PR reference format: ${input}
Valid formats:
  - https://github.com/owner/repo/pull/123
  - owner/repo#123`);
}

function formatResults(
  result: any,
  format: 'text' | 'json',
  verbose: boolean,
  prRef: PRReference,
  showDiffs: boolean = false
) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Text format
  console.log(`\n🔍 Analyzing PR #${prRef.number} from ${prRef.owner}/${prRef.repo}`);
  console.log('='.repeat(60));

  const { overallResult, fileResults } = result;

  // Overall result
  const emoji = overallResult.isHumanLike ? '👤' : '🤖';
  const label = overallResult.isHumanLike ? 'HUMAN-WRITTEN' : 'AI-GENERATED';

  console.log(`${emoji} Overall Assessment: ${label}`);
  console.log(`📊 Confidence: ${overallResult.confidence.toFixed(1)}%`);
  console.log(`💭 Reasoning: ${overallResult.reasoning}`);
  console.log(`🏷️  Indicators: ${overallResult.indicators.join(', ')}`);

  if (verbose && fileResults.length > 1) {
    console.log('\n📁 File-by-file Analysis:');
    console.log('-'.repeat(40));

    fileResults.forEach((file: any, index: number) => {
      const fileEmoji = file.result.isHumanLike ? '👤' : '🤖';
      const fileLabel = file.result.isHumanLike ? 'HUMAN' : 'AI';

      console.log(`\n${index + 1}. ${file.filename}`);
      console.log(`   ${fileEmoji} ${fileLabel} (${file.result.confidence.toFixed(1)}%)`);
      console.log(`   ${file.result.reasoning}`);
      if (file.result.indicators.length > 0) {
        console.log(`   Indicators: ${file.result.indicators.join(', ')}`);
      }

      if (showDiffs && file.patch) {
        console.log(`   Diff:`);
        console.log(`   ${file.patch.split('\n').join('\n   ')}`);
      }
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (overallResult.isHumanLike) {
    console.log('✅ This PR appears to be human-written');
  } else {
    console.log('🚨 This PR appears to be AI-generated');
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      format: { type: 'string', default: 'text' },
      'github-token': { type: 'string' },
      'openai-key': { type: 'string' },
      verbose: { type: 'boolean', short: 'v' },
      'show-diffs': { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const options = values as CLIOptions;

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (positionals.length === 0) {
    console.error('❌ Error: Please provide a PR URL or reference');
    showHelp();
    process.exit(1);
  }

  const prInput = positionals[0];
  let prRef: PRReference;

  try {
    prRef = parsePRReference(prInput);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }

  // Get API keys
  const openaiKey = options['openai-key'] || process.env.OPENAI_API_KEY;
  const githubToken = options['github-token'] || process.env.GITHUB_TOKEN;

  if (!openaiKey) {
    console.error('❌ Error: OpenAI API key is required');
    console.error('Set OPENAI_API_KEY environment variable or use --openai-key');
    process.exit(1);
  }

  if (options.format && !['text', 'json'].includes(options.format)) {
    console.error('❌ Error: Format must be either "text" or "json"');
    process.exit(1);
  }

  try {
    // Initialize clients
    const github = new GitHubClient({
      GITHUB_TOKEN: githubToken,
      GITHUB_WEBHOOK_SECRET: '', // Not needed for CLI
    });

    const evaluator = new LLMEvaluator({
      OPENAI_API_KEY: openaiKey,
    });

    // Fetch PR data
    console.log(`🔄 Fetching PR data for ${prRef.owner}/${prRef.repo}#${prRef.number}...`);
    const prData = await github.fetchPullRequestFiles(prRef.owner, prRef.repo, prRef.number);

    if (prData.length === 0) {
      console.log('⚠️  No files found in this PR');
      process.exit(0);
    }

    console.log(`📄 Found ${prData.length} file(s) to analyze`);

    // Evaluate the PR
    console.log('🧠 Running LLM evaluation...');
    const result = await evaluator.evaluatePullRequest(prData);

    // Format and display results
    formatResults(
      result,
      options.format as 'text' | 'json',
      !!options.verbose,
      prRef,
      !!options['show-diffs']
    );
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
