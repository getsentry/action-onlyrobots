import { LLMEvaluator } from '../llm-evaluator-simplified';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { config } from 'dotenv';

// Load environment variables
config();

interface PRExample {
  id: string;
  url: string;
  repo: string;
  prNumber: number;
  title: string;
  description: string;
  author: string;
  createdAt: string;
  files: Array<{
    filename: string;
    patch: string;
  }>;
  context: {
    title: string;
    description: string;
    commitMessages: string[];
  };
  metadata: {
    isAI: boolean;
    tool?: string;
    notes?: string;
    addedBy: string;
    addedAt: string;
  };
}

export class SimplifiedEvalRunner {
  private evaluator: LLMEvaluator;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.evaluator = new LLMEvaluator({ OPENAI_API_KEY: apiKey });
  }

  async runEvaluation(options: { limit?: number; concurrency?: number } = {}) {
    const { limit, concurrency = 4 } = options;

    console.log('🚀 Starting PR evaluation with simplified evaluator...\n');

    // Load all PRs from the dataset
    const prs = await this.loadPRDataset();
    const prsToEvaluate = limit ? prs.slice(0, limit) : prs;

    console.log(`📋 Evaluating ${prsToEvaluate.length} total PRs\n`);
    console.log(`🔄 Running with concurrency: ${concurrency}\n`);

    const results: any[] = [];
    const startTime = Date.now();

    // Process PRs in batches
    for (let i = 0; i < prsToEvaluate.length; i += concurrency) {
      const batch = prsToEvaluate.slice(i, Math.min(i + concurrency, prsToEvaluate.length));
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(prsToEvaluate.length / concurrency);

      console.log(
        `⏳ Processing batch ${batchNum}/${totalBatches} (PRs ${i + 1}-${Math.min(i + concurrency, prsToEvaluate.length)})...\n`
      );

      const batchPromises = batch.map(async (pr, batchIndex) => {
        const prIndex = i + batchIndex;
        const startTime = Date.now();

        try {
          const prContext = {
            title: pr.context.title,
            description: pr.context.description,
            commitMessages: pr.context.commitMessages,
            author: pr.author,
          };

          const result = await this.evaluator.evaluatePullRequest(pr.files, prContext);
          const duration = (Date.now() - startTime) / 1000;

          const isCorrect = result.isHumanLike !== pr.metadata.isAI;
          const detected = result.isHumanLike ? 'Human' : 'AI';
          const expected = pr.metadata.isAI
            ? `AI${pr.metadata.tool ? ` (${pr.metadata.tool})` : ''}`
            : 'Human';

          console.log(`[${prIndex + 1}/${prsToEvaluate.length}] ${pr.url}`);
          console.log(`   Title: ${pr.title}`);
          console.log(`   Expected: ${expected}`);
          console.log(`   Detected: ${detected} (${result.confidence}% confidence)`);
          console.log(`   Result: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
          console.log(`   Duration: ${duration.toFixed(1)}s\n`);

          return {
            prIndex,
            pr,
            result,
            isCorrect,
            expected,
            detected,
            duration,
          };
        } catch (error) {
          console.error(
            `[${prIndex + 1}/${prsToEvaluate.length}] Error evaluating ${pr.url}:`,
            error
          );
          return {
            prIndex,
            pr,
            error: error instanceof Error ? error.message : String(error),
            isCorrect: false,
            expected: pr.metadata.isAI ? 'AI' : 'Human',
            detected: 'Error',
            duration: (Date.now() - startTime) / 1000,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add rate limiting pause between batches
      if (i + concurrency < prsToEvaluate.length) {
        console.log('⏱️  Rate limiting pause...\n');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Calculate and display summary
    const totalDuration = (Date.now() - startTime) / 1000;
    this.displaySummary(results, totalDuration);

    // Save results
    await this.saveResults(results);
  }

  private async loadPRDataset(): Promise<PRExample[]> {
    const dataDir = path.join(__dirname, '../test/datasets/real-prs');

    try {
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const prs = await Promise.all(
        jsonFiles.map(async (file) => {
          const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
          return JSON.parse(content) as PRExample;
        })
      );

      return prs;
    } catch (error) {
      console.error('Error loading PR dataset:', error);
      return [];
    }
  }

  private displaySummary(results: any[], totalDuration: number) {
    const correct = results.filter((r) => r.isCorrect).length;
    const total = results.length;
    const accuracy = (correct / total) * 100;

    const errors = results.filter((r) => r.error);
    const humanPRs = results.filter((r) => !r.pr.metadata.isAI);
    const aiPRs = results.filter((r) => r.pr.metadata.isAI);

    const humanCorrect = humanPRs.filter((r) => r.isCorrect).length;
    const aiCorrect = aiPRs.filter((r) => r.isCorrect).length;

    const falsePositives = humanPRs.filter((r) => !r.isCorrect).length;
    const falseNegatives = aiPRs.filter((r) => !r.isCorrect).length;

    // Group by AI tool
    const toolGroups = new Map<string, { correct: number; total: number }>();
    toolGroups.set('Human', { correct: humanCorrect, total: humanPRs.length });

    aiPRs.forEach((r) => {
      const tool = r.pr.metadata.tool || 'Unknown';
      const group = toolGroups.get(tool) || { correct: 0, total: 0 };
      group.total++;
      if (r.isCorrect) group.correct++;
      toolGroups.set(tool, group);
    });

    // Calculate confidence levels
    const avgConfidence =
      results.filter((r) => r.result).reduce((sum, r) => sum + r.result.confidence, 0) /
      results.filter((r) => r.result).length;

    const correctAvgConfidence =
      results
        .filter((r) => r.result && r.isCorrect)
        .reduce((sum, r) => sum + r.result.confidence, 0) /
      results.filter((r) => r.result && r.isCorrect).length;

    const incorrectAvgConfidence =
      results
        .filter((r) => r.result && !r.isCorrect)
        .reduce((sum, r) => sum + r.result.confidence, 0) /
      results.filter((r) => r.result && !r.isCorrect).length;

    console.log('='.repeat(60));
    console.log('📊 EVALUATION SUMMARY (Simplified Evaluator)');
    console.log('='.repeat(60));

    console.log(`\n📈 Overall Accuracy: ${accuracy.toFixed(1)}% (${correct}/${total})`);
    console.log(
      `   False Positives: ${falsePositives} (${((falsePositives / total) * 100).toFixed(1)}%)`
    );
    console.log(
      `   False Negatives: ${falseNegatives} (${((falseNegatives / total) * 100).toFixed(1)}%)`
    );

    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
    }

    console.log('\n🎯 Accuracy by Category:');
    toolGroups.forEach((stats, tool) => {
      const toolAccuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      console.log(`   ${tool}: ${toolAccuracy.toFixed(1)}% (${stats.correct}/${stats.total})`);
    });

    console.log('\n💡 Confidence Levels:');
    console.log(`   Overall Average: ${avgConfidence.toFixed(1)}%`);
    console.log(`   When Correct: ${correctAvgConfidence.toFixed(1)}%`);
    console.log(`   When Wrong: ${incorrectAvgConfidence.toFixed(1)}%`);

    if (results.filter((r) => !r.isCorrect).length > 0) {
      console.log('\n❌ Misclassified PRs:');
      results
        .filter((r) => !r.isCorrect)
        .forEach((r) => {
          console.log(`   ${r.pr.url}`);
          console.log(
            `      Expected: ${r.expected}, Got: ${r.detected} (${r.result?.confidence || 0}%)`
          );
        });
    }

    console.log(`\n⏱️  Total evaluation time: ${totalDuration.toFixed(1)}s`);
    console.log('\n' + '='.repeat(60));
  }

  private async saveResults(results: any[]) {
    const resultsDir = path.join(__dirname, '../../eval-results');
    await fs.mkdir(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const filename = `eval-simplified-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${path.relative(process.cwd(), filepath)}`);
  }
}

// CLI interface
if (require.main === module) {
  const runner = new SimplifiedEvalRunner();
  runner.runEvaluation().catch(console.error);
}
