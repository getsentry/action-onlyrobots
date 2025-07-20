#!/usr/bin/env node
import { config } from 'dotenv';
import { Command } from 'commander';
import { EvalRunner } from './runner';
import { PRFetcher } from '../test/utils/pr-fetcher';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Load environment variables from .env file
config();

const program = new Command();

program.name('eval').description('Evaluate AI detection on real PRs').version('1.0.0');

program
  .command('run')
  .description('Run evaluation on all PRs in the dataset')
  .option('--limit <number>', 'Limit number of PRs to evaluate', parseInt)
  .option('--concurrency <number>', 'Number of PRs to evaluate in parallel (default: 4)', parseInt)
  .action(async (options) => {
    try {
      const runner = new EvalRunner();
      await runner.runEvaluation({
        limit: options.limit,
        concurrency: options.concurrency || 4,
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('add-pr <url>')
  .description('Add a PR to the evaluation dataset')
  .option('--ai', 'Mark as AI-generated')
  .option('--human', 'Mark as human-written')
  .option('--tool <tool>', 'Specify the AI tool (e.g., "Claude Code")')
  .option('--notes <notes>', 'Additional notes')
  .action(async (url, options) => {
    if (!options.ai && !options.human) {
      console.error('Error: Specify either --ai or --human');
      process.exit(1);
    }

    try {
      const fetcher = new PRFetcher();
      console.log(`📥 Fetching PR: ${url}`);

      const prData = await fetcher.fetchPR(url);

      const example = {
        ...prData,
        metadata: {
          isAI: !!options.ai,
          tool: options.tool,
          notes: options.notes,
          addedBy: process.env.USER || 'unknown',
          addedAt: new Date().toISOString(),
        },
      };

      // Save to individual file
      const dataDir = path.join(__dirname, '../test/datasets/real-prs');
      await fs.mkdir(dataDir, { recursive: true });

      // Create filename from PR URL (owner-repo-number.json)
      const filename = `${prData.repo.replace('/', '-')}-${prData.prNumber}.json`;
      const filePath = path.join(dataDir, filename);

      // Check if file already exists
      try {
        await fs.access(filePath);
        console.log('⚠️  PR already exists in dataset');
        return;
      } catch {
        // File doesn't exist, we can continue
      }

      await fs.writeFile(filePath, JSON.stringify(example, null, 2));

      console.log(`✅ Added to ${filename}`);
      console.log(`   Title: ${example.title}`);
      console.log(`   Files: ${example.files.length}`);
      console.log(`   Type: ${options.ai ? `AI (${options.tool || 'unknown'})` : 'Human'}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show dataset statistics')
  .action(async () => {
    try {
      const dataDir = path.join(__dirname, '../test/datasets/real-prs');
      const files = await fs.readdir(dataDir).catch(() => []);

      let aiCount = 0;
      let humanCount = 0;
      const toolStats: Record<string, number> = {};

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const pr = JSON.parse(content);

        if (pr.metadata.isAI) {
          aiCount++;
          const tool = pr.metadata.tool || 'unknown';
          toolStats[tool] = (toolStats[tool] || 0) + 1;
        } else {
          humanCount++;
        }
      }

      const total = aiCount + humanCount;

      console.log('\n📊 Dataset Statistics:');
      console.log(`=${'='.repeat(30)}`);

      if (total === 0) {
        console.log('No PRs in dataset yet!');
        console.log('\nAdd PRs using:');
        console.log('  pnpm run eval add-pr <url> --ai --tool="Claude Code"');
        console.log('  pnpm run eval add-pr <url> --human');
      } else {
        console.log(`AI-generated: ${aiCount} PRs`);
        if (aiCount > 0) {
          Object.entries(toolStats).forEach(([tool, count]) => {
            console.log(`  ${tool}: ${count}`);
          });
        }
        console.log(`Human-written: ${humanCount} PRs`);
        console.log(`-${'-'.repeat(30)}`);
        console.log(`Total: ${total} PRs`);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all PRs in the dataset')
  .action(async () => {
    try {
      const dataDir = path.join(__dirname, '../test/datasets/real-prs');
      const files = await fs.readdir(dataDir).catch(() => []);

      console.log('\n📋 PRs in Dataset:');
      console.log(`=${'='.repeat(60)}`);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const pr = JSON.parse(content);

        console.log(`\n${pr.url}`);
        console.log(`  Title: ${pr.title}`);
        console.log(
          `  Type: ${pr.metadata.isAI ? `AI (${pr.metadata.tool || 'unknown'})` : 'Human'}`
        );
        console.log(`  Added: ${new Date(pr.metadata.addedAt).toLocaleDateString()}`);
        if (pr.metadata.notes) {
          console.log(`  Notes: ${pr.metadata.notes}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// If no command is provided, default to 'run'
const args = process.argv.slice(2);
const hasCommand =
  args.length > 0 &&
  !args[0].startsWith('-') &&
  ['run', 'add-pr', 'stats', 'list'].includes(args[0]);
if (!hasCommand) {
  process.argv.splice(2, 0, 'run');
}

program.parse();
