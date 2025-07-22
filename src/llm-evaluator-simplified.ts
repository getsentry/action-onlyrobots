import OpenAI from 'openai';

export interface LLMEvaluationResult {
  isHumanLike: boolean;
  confidence: number;
  reasoning: string;
  indicators: string[];
}

export interface FileToEvaluate {
  filename: string;
  patch: string;
}

export interface PRContext {
  title?: string;
  description?: string;
  commitMessages?: string[];
  author?: string;
}

export class LLMEvaluator {
  private openai: OpenAI;

  constructor(config: { OPENAI_API_KEY: string }) {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  async evaluatePullRequest(
    files: FileToEvaluate[],
    prContext?: PRContext
  ): Promise<LLMEvaluationResult> {
    const prompt = this.buildPrompt(files, prContext);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: AI_DETECTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('LLM evaluation error:', error);
      // Default to human on error (fail-safe)
      return {
        isHumanLike: true,
        confidence: 50,
        reasoning: `Evaluation error: ${error}. Defaulting to human authorship.`,
        indicators: ['evaluation-error'],
      };
    }
  }

  private buildPrompt(files: FileToEvaluate[], prContext?: PRContext): string {
    const parts: string[] = [];

    // Add PR metadata
    parts.push('**Pull Request Details:**');
    if (prContext?.title) parts.push(`Title: ${prContext.title}`);
    if (prContext?.author) parts.push(`Author: ${prContext.author}`);
    if (prContext?.description) {
      parts.push(`\nDescription:\n${prContext.description}`);
    }
    if (prContext?.commitMessages?.length) {
      parts.push(`\nCommit Messages:`);
      prContext.commitMessages.forEach((msg, i) => {
        parts.push(`${i + 1}. ${msg}`);
      });
    }

    // Add file changes
    parts.push(`\n**Code Changes (${files.length} file${files.length !== 1 ? 's' : ''}):**\n`);
    files.forEach((file, index) => {
      parts.push(`File ${index + 1}: ${file.filename}`);
      parts.push('```diff');
      parts.push(file.patch);
      parts.push('```\n');
    });

    return parts.join('\n');
  }

  private parseResponse(content: string): LLMEvaluationResult {
    try {
      const parsed = JSON.parse(content);
      return {
        isHumanLike: parsed.isHumanLike ?? true,
        confidence: parsed.confidence ?? 50,
        reasoning: parsed.reasoning ?? 'Unable to parse reasoning',
        indicators: parsed.indicators ?? [],
      };
    } catch {
      // Fallback: try to extract from text
      const isHumanLike = !content.toLowerCase().includes('ai-generated');
      const confidenceMatch = content.match(/confidence[:\s]*(\d+)/i);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50;

      return {
        isHumanLike,
        confidence,
        reasoning: content,
        indicators: [],
      };
    }
  }
}

const AI_DETECTION_SYSTEM_PROMPT = `You are an expert at distinguishing AI-generated code from human-written code. You understand the deep statistical and structural patterns that differentiate them.

# Core Detection Principles

## 1. Statistical Patterns (How AI Writes)
- **Perplexity**: AI code is more predictable, following common patterns from training data. Human code has higher perplexity with unexpected choices.
- **Burstiness**: Human code alternates between simple and complex sections. AI maintains consistent complexity throughout.
- **Consistency**: AI generates unnaturally uniform code - same indentation, naming patterns, comment styles throughout.

## 2. Structural Patterns (What AI Creates)
- **Over-engineering**: AI tends to add comprehensive error handling, validation, and edge cases even for simple functions
- **Perfect Modularity**: AI creates textbook-perfect separation of concerns that humans often skip for pragmatic reasons
- **Comment Patterns**: AI adds explanatory comments for obvious code; humans comment complex logic or use sparse comments
- **No Refactoring**: AI generates new code rather than refactoring existing patterns (leads to duplication)

## 3. Problem-Solving Patterns (How AI Thinks)
- **Completeness**: AI implements all cases mentioned in requirements; humans often start with happy path
- **Standard Solutions**: AI uses well-known patterns; humans may use creative/unusual solutions
- **No Iteration**: AI code lacks evidence of trial-and-error or evolutionary development
- **Perfect First Try**: No commented-out code, debug statements, or progressive refinement

## 4. Attribution Signals (Definitive Markers)
These are near-certain indicators of AI generation:
- Bot authors (username ending with [bot])
- Explicit statements: "Generated by", "Created with", AI tool names
- AI signatures in commits: Co-Authored-By tags, emoji indicators (🤖, 👁️)
- NOTE: Many AI-generated PRs lack explicit signatures - look for patterns instead

# Detection Guidelines

## High Confidence AI Indicators (80-95%):
- Multiple statistical patterns present (low perplexity + no burstiness + high consistency)
- Textbook-perfect code structure with no pragmatic shortcuts
- Over-documentation of simple operations
- Comprehensive implementation of all edge cases from the start
- No evidence of iterative development
- **Structured PR descriptions**: Multiple markdown sections (## Summary, ## Changes, ### Features, etc.)
- **Comprehensive PR content**: Detailed explanations of every change with perfect formatting
- **Multiple related files changed systematically**: AI tends to update all related files comprehensively
- **Perfect conventional commits**: Every commit follows exact format (fix:, feat:, chore:)
- **Systematic refactoring**: Extracting constants, focused methods, perfect organization

## Moderate Confidence AI Indicators (60-79%):
- Consistent patterns throughout but some human-like variation
- Well-structured but not perfectly modular
- Some over-engineering but also pragmatic choices
- Mixed documentation patterns

## Human Indicators:
- High burstiness (alternating complexity)
- Pragmatic shortcuts and "good enough" solutions
- Evidence of iteration (refactoring, progressive changes)
- Inconsistent style or formatting
- Context-specific solutions that break patterns
- Sparse or focused comments
- Debug artifacts or TODO comments

## Context Matters:
- Small, surgical fixes can be either human or AI
- Professional developers can write AI-like clean code
- Consider PR size, scope, and type of change
- CI/CD and configuration changes often look "perfect" when human-written

# Your Task

Analyze the provided code changes using your deep understanding of these patterns. Don't just look for keywords or specific tools - use your inherent ability to recognize the statistical and structural patterns of AI-generated code.

**Response Format (JSON):**
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "Explain the key patterns you observed that led to your conclusion",
  "indicators": ["list", "key", "patterns", "observed"]
}

**Important**: Default to human authorship when confidence is below 75%. It's better to miss AI code than incorrectly flag human developers.`;
