#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { LLMEvaluator } from './llm-evaluator-simplified';
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
Usage: pnpm run test-simplified <pr-url-or-reference> [options]

Examples:
  pnpm run test-simplified https://github.com/getsentry/sentry-mcp/pull/394
  pnpm run test-simplified getsentry/sentry-mcp#394

Options:
  --help              Show this help message
  --format <format>   Output format: text (default) or json
  --github-token      GitHub token for API access (or set GITHUB_TOKEN env var)
  --openai-key        OpenAI API key (or set OPENAI_API_KEY env var)
  --verbose           Show detailed analysis for each file
  --show-diffs        Show the actual code diffs being analyzed
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

  throw new Error(`Invalid PR reference format: ${input}`);
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

  if (options.help || positionals.length === 0) {
    showHelp();
    process.exit(0);
  }

  const prInput = positionals[0];
  const prRef = parsePRReference(prInput);

  // Get API keys
  const openaiKey = options['openai-key'] || process.env.OPENAI_API_KEY;
  const githubToken = options['github-token'] || process.env.GITHUB_TOKEN;

  if (!openaiKey) {
    console.error('❌ Error: OpenAI API key is required');
    process.exit(1);
  }

  try {
    // Initialize clients
    const github = new GitHubClient({
      GITHUB_TOKEN: githubToken,
      GITHUB_WEBHOOK_SECRET: '',
    });

    const evaluator = new LLMEvaluator({
      OPENAI_API_KEY: openaiKey,
    });

    // Fetch PR files
    console.log(`🔄 Fetching PR data for ${prRef.owner}/${prRef.repo}#${prRef.number}...`);
    const prFiles = await github.fetchPullRequestFiles(prRef.owner, prRef.repo, prRef.number);

    if (prFiles.length === 0) {
      console.log('⚠️  No files found in this PR');
      process.exit(0);
    }

    // Fetch PR context
    const prResponse = await fetch(
      `https://api.github.com/repos/${prRef.owner}/${prRef.repo}/pulls/${prRef.number}`,
      {
        headers: githubToken
          ? {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'action-onlyrobots-test/1.0',
            }
          : {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'action-onlyrobots-test/1.0',
            },
      }
    );

    const prInfo = (await prResponse.json()) as any;

    // Fetch commit messages
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${prRef.owner}/${prRef.repo}/pulls/${prRef.number}/commits`,
      {
        headers: githubToken
          ? {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'action-onlyrobots-test/1.0',
            }
          : {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'action-onlyrobots-test/1.0',
            },
      }
    );

    const commitMessages = commitsResponse.ok
      ? ((await commitsResponse.json()) as any[]).map((commit: any) => commit.commit.message)
      : [];

    const prContext = {
      title: prInfo.title,
      description: prInfo.body,
      author: prInfo.user?.login,
      commitMessages,
    };

    console.log(`📄 Found ${prFiles.length} file(s) to analyze`);
    console.log(`👤 Author: ${prContext.author}`);
    console.log(`📝 Title: ${prContext.title}`);

    // Evaluate the PR
    console.log('\n🧠 Running simplified LLM evaluation...');
    const result = await evaluator.evaluatePullRequest(prFiles, prContext);

    // Display results
    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n' + '='.repeat(60));
      const emoji = result.isHumanLike ? '👤' : '🤖';
      const label = result.isHumanLike ? 'HUMAN-WRITTEN' : 'AI-GENERATED';

      console.log(`${emoji} Assessment: ${label}`);
      console.log(`📊 Confidence: ${result.confidence}%`);
      console.log(`\n💭 Reasoning:`);
      console.log(result.reasoning);

      if (result.indicators.length > 0) {
        console.log(`\n🏷️  Key Indicators:`);
        result.indicators.forEach((indicator) => {
          console.log(`  • ${indicator}`);
        });
      }
      console.log('='.repeat(60));
    }

    if (options['show-diffs']) {
      console.log('\n📄 Code Changes:');
      prFiles.forEach((file, i) => {
        console.log(`\nFile ${i + 1}: ${file.filename}`);
        console.log('```diff');
        console.log(file.patch);
        console.log('```');
      });
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    if (options.verbose && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the CLI
main().catch(console.error);
