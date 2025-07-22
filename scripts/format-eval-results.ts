#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import type { EvalSummary } from '../src/eval/runner';

// Read the latest eval results from stdin or file
const evalResultsPath = process.argv[2] || 'eval-results/latest.json';

try {
  const data = readFileSync(evalResultsPath, 'utf-8');
  const summary: EvalSummary = JSON.parse(data);

  // Format as markdown for GitHub comment
  const accuracyPercent = (summary.accuracy * 100).toFixed(1);
  const accuracyEmoji = summary.accuracy >= 0.9 ? '🟢' : summary.accuracy >= 0.8 ? '🟡' : '🔴';

  console.log(`## 🤖 AI Detection Evaluation Results

${accuracyEmoji} **Overall Accuracy: ${accuracyPercent}%** (${summary.correct}/${summary.totalPRs} correct)

### 📊 Detection Metrics

| Metric | Count | Rate |
|--------|-------|------|
| ✅ Correct Classifications | ${summary.correct} | ${accuracyPercent}% |
| ❌ Incorrect Classifications | ${summary.incorrect} | ${((summary.incorrect / summary.totalPRs) * 100).toFixed(1)}% |
| ⚠️ False Positives (Human → AI) | ${summary.falsePositives} | ${((summary.falsePositives / summary.totalPRs) * 100).toFixed(1)}% |
| ⚠️ False Negatives (AI → Human) | ${summary.falseNegatives} | ${((summary.falseNegatives / summary.totalPRs) * 100).toFixed(1)}% |

### 🎯 Accuracy by Category

| Category | Accuracy | Correct/Total |
|----------|----------|---------------|`);

  // Sort by total count descending
  const sortedTools = Object.entries(summary.byTool).sort((a, b) => b[1].total - a[1].total);

  for (const [tool, stats] of sortedTools) {
    const toolAccuracy = (stats.accuracy * 100).toFixed(1);
    const toolEmoji = stats.accuracy >= 0.9 ? '✅' : stats.accuracy >= 0.7 ? '⚠️' : '❌';
    console.log(`| ${toolEmoji} ${tool} | ${toolAccuracy}% | ${stats.correct}/${stats.total} |`);
  }

  console.log(`
### 💡 Confidence Analysis

- **Average Confidence**: ${summary.avgConfidence.overall}%
- **When Correct**: ${summary.avgConfidence.correct}% 
- **When Incorrect**: ${summary.avgConfidence.incorrect}%

${summary.avgConfidence.incorrect > summary.avgConfidence.correct ? '⚠️ The system is overconfident when making mistakes.' : '✅ The system is appropriately less confident when making mistakes.'}`);

  if (summary.incorrect > 0) {
    console.log(`
### ❌ Recent Misclassifications

<details>
<summary>Click to see misclassified PRs</summary>

| PR | Expected | Detected | Confidence |
|----|----------|----------|------------|`);

    const errors = summary.results.filter((r) => !r.correct).slice(0, 10);
    for (const error of errors) {
      const prLink = `[${error.pr.title.substring(0, 50)}${error.pr.title.length > 50 ? '...' : ''}](${error.pr.url})`;
      const expected = error.expected.isAI ? `AI (${error.expected.tool || 'unknown'})` : 'Human';
      const detected = error.actual.isAI ? 'AI' : 'Human';
      console.log(`| ${prLink} | ${expected} | ${detected} | ${Math.round(error.actual.confidence)}% |`);
    }

    if (summary.results.filter((r) => !r.correct).length > 10) {
      console.log(`| ... and ${summary.results.filter((r) => !r.correct).length - 10} more | | | |`);
    }

    console.log(`
</details>`);
  }

  console.log(`
---
*This evaluation tests the accuracy of our AI detection system against a dataset of ${summary.totalPRs} known AI-generated and human-written PRs.*`);

} catch (error) {
  console.error('Error formatting eval results:', error);
  process.exit(1);
}