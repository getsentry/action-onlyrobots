import { LLMEvaluator } from '../llm-evaluator';
import { RealPRLoader } from '../test/utils/real-pr-loader';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface EvalResult {
  pr: {
    url: string;
    title: string;
    author: string;
    tool?: string;
  };
  expected: {
    isAI: boolean;
    tool?: string;
  };
  actual: {
    isAI: boolean;
    confidence: number;
    reasoning: string;
    indicators: string[];
  };
  correct: boolean;
  toolCorrect?: boolean;
  duration: number;
}

export interface EvalSummary {
  totalPRs: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  falsePositives: number;
  falseNegatives: number;
  byTool: Record<string, { total: number; correct: number; accuracy: number }>;
  avgConfidence: {
    overall: number;
    correct: number;
    incorrect: number;
  };
  results: EvalResult[];
}

export class EvalRunner {
  private evaluator: LLMEvaluator;
  private loader: RealPRLoader;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.evaluator = new LLMEvaluator({ OPENAI_API_KEY: apiKey });
    this.loader = new RealPRLoader();
  }

  async runEvaluation(filter?: { limit?: number; concurrency?: number }): Promise<EvalSummary> {
    console.log('🚀 Starting PR evaluation...\n');

    // Load all PRs
    let prs = await this.loader.loadAllPRs();
    console.log(`📋 Evaluating ${prs.length} total PRs`);

    if (prs.length === 0) {
      console.log('\n❌ No PRs found in dataset!');
      console.log('Add PRs using: pnpm run eval add-pr <url> --ai --tool="Claude Code"\n');
      return this.emptySummary();
    }

    if (filter?.limit) {
      prs = prs.slice(0, filter.limit);
    }

    // Run evaluations with configurable concurrency
    const concurrency = filter?.concurrency || 4;
    console.log(`\n🔄 Running with concurrency: ${concurrency}`);

    const results: EvalResult[] = [];
    const errors: Array<{ pr: any; error: any }> = [];

    // Process PRs in batches
    let processedCount = 0;
    for (let i = 0; i < prs.length; i += concurrency) {
      const batch = prs.slice(i, Math.min(i + concurrency, prs.length));

      // Show batch progress
      console.log(
        `\n⏳ Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(prs.length / concurrency)} (PRs ${i + 1}-${Math.min(i + batch.length, prs.length)})...`
      );

      const batchPromises = batch.map(async (pr, batchIndex) => {
        const prIndex = i + batchIndex + 1;
        const startTime = Date.now();

        try {
          const result = await this.evaluator.evaluatePullRequest(pr.files, pr.context);
          const duration = Date.now() - startTime;

          const isAI = !result.overallResult.isHumanLike;
          const correct = isAI === pr.metadata.isAI;

          return {
            prIndex,
            pr: {
              url: pr.url,
              title: pr.title,
              author: pr.author,
              tool: pr.metadata.tool,
            },
            expected: {
              isAI: pr.metadata.isAI,
              tool: pr.metadata.tool,
            },
            actual: {
              isAI,
              confidence: result.overallResult.confidence,
              reasoning: result.overallResult.reasoning,
              indicators: result.overallResult.indicators,
            },
            correct,
            toolCorrect: pr.metadata.tool
              ? result.overallResult.reasoning
                  .toLowerCase()
                  .includes(pr.metadata.tool.toLowerCase())
              : undefined,
            duration,
          };
        } catch (error) {
          errors.push({ pr, error });
          return {
            prIndex,
            pr,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Display results in order
      for (const result of batchResults.sort((a, b) => a.prIndex - b.prIndex)) {
        processedCount++;

        if ('error' in result) {
          console.log(`\n[${result.prIndex}/${prs.length}] ❌ Failed: ${result.pr.url}`);
          console.log(`   Error: ${result.error}`);
        } else {
          console.log(`\n[${result.prIndex}/${prs.length}] ${result.pr.url}`);
          console.log(`   Title: ${result.pr.title}`);
          console.log(
            `   Expected: ${result.expected.isAI ? `AI (${result.expected.tool || 'unknown'})` : 'Human'}`
          );
          console.log(
            `   Detected: ${result.actual.isAI ? 'AI' : 'Human'} (${Math.round(result.actual.confidence)}% confidence)`
          );
          console.log(`   Result: ${result.correct ? '✅ Correct' : '❌ Incorrect'}`);
          console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);

          results.push(result);
        }
      }

      // Rate limiting between batches (only if not the last batch)
      if (i + concurrency < prs.length) {
        console.log('\n⏱️  Rate limiting pause...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(results);

    // Print summary
    this.printSummary(summary);

    // Save results
    await this.saveResults(summary);

    return summary;
  }

  private calculateSummary(results: EvalResult[]): EvalSummary {
    const correct = results.filter((r) => r.correct).length;
    const incorrect = results.length - correct;

    const falsePositives = results.filter((r) => !r.expected.isAI && r.actual.isAI).length;

    const falseNegatives = results.filter((r) => r.expected.isAI && !r.actual.isAI).length;

    // By tool accuracy
    const byTool: Record<string, { total: number; correct: number; accuracy: number }> = {};

    // Group by expected tool
    for (const result of results) {
      const tool = result.expected.tool || (result.expected.isAI ? 'Unknown AI' : 'Human');

      if (!byTool[tool]) {
        byTool[tool] = { total: 0, correct: 0, accuracy: 0 };
      }

      byTool[tool].total++;
      if (result.correct) {
        byTool[tool].correct++;
      }
    }

    // Calculate tool accuracies
    for (const tool of Object.keys(byTool)) {
      byTool[tool].accuracy = byTool[tool].correct / byTool[tool].total;
    }

    // Average confidence
    const allConfidences = results.map((r) => r.actual.confidence);
    const correctConfidences = results.filter((r) => r.correct).map((r) => r.actual.confidence);
    const incorrectConfidences = results.filter((r) => !r.correct).map((r) => r.actual.confidence);

    return {
      totalPRs: results.length,
      correct,
      incorrect,
      accuracy: correct / results.length,
      falsePositives,
      falseNegatives,
      byTool,
      avgConfidence: {
        overall: this.average(allConfidences),
        correct: this.average(correctConfidences),
        incorrect: this.average(incorrectConfidences),
      },
      results,
    };
  }

  private average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  private printSummary(summary: EvalSummary): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 EVALUATION SUMMARY');
    console.log('='.repeat(60));

    console.log(
      `\n📈 Overall Accuracy: ${(summary.accuracy * 100).toFixed(1)}% (${summary.correct}/${summary.totalPRs})`
    );
    console.log(
      `   False Positives: ${summary.falsePositives} (${((summary.falsePositives / summary.totalPRs) * 100).toFixed(1)}%)`
    );
    console.log(
      `   False Negatives: ${summary.falseNegatives} (${((summary.falseNegatives / summary.totalPRs) * 100).toFixed(1)}%)`
    );

    console.log('\n🎯 Accuracy by Category:');
    for (const [tool, stats] of Object.entries(summary.byTool)) {
      console.log(
        `   ${tool}: ${(stats.accuracy * 100).toFixed(1)}% (${stats.correct}/${stats.total})`
      );
    }

    console.log('\n💡 Confidence Levels:');
    console.log(`   Overall Average: ${summary.avgConfidence.overall.toFixed(1)}%`);
    console.log(`   When Correct: ${summary.avgConfidence.correct.toFixed(1)}%`);
    console.log(`   When Wrong: ${summary.avgConfidence.incorrect.toFixed(1)}%`);

    if (summary.incorrect > 0) {
      console.log('\n❌ Misclassified PRs:');
      const errors = summary.results.filter((r) => !r.correct);
      for (const error of errors.slice(0, 5)) {
        console.log(`   ${error.pr.url}`);
        console.log(
          `      Expected: ${error.expected.isAI ? 'AI' : 'Human'}, Got: ${error.actual.isAI ? 'AI' : 'Human'} (${Math.round(error.actual.confidence)}%)`
        );
      }
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
  }

  private async saveResults(summary: EvalSummary): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const resultsDir = path.join(__dirname, '../../eval-results');

    await fs.mkdir(resultsDir, { recursive: true });

    const filename = path.join(resultsDir, `eval-${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(summary, null, 2));

    console.log(`\n💾 Results saved to: ${path.relative(process.cwd(), filename)}`);
  }

  private emptySummary(): EvalSummary {
    return {
      totalPRs: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
      falsePositives: 0,
      falseNegatives: 0,
      byTool: {},
      avgConfidence: {
        overall: 0,
        correct: 0,
        incorrect: 0,
      },
      results: [],
    };
  }
}
