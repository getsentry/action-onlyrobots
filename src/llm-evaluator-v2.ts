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
    // Build a comprehensive prompt that includes all context
    const prompt = this.buildComprehensivePrompt(files, prContext);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT_V2,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('LLM evaluation error:', error);
      // Default to human on error
      return {
        isHumanLike: true,
        confidence: 50,
        reasoning: `Error during evaluation: ${error}`,
        indicators: ['evaluation-error'],
      };
    }
  }

  private buildComprehensivePrompt(files: FileToEvaluate[], prContext?: PRContext): string {
    let prompt = `Analyze this pull request to determine if it was written by a human or an AI agent.\n\n`;

    // Add PR context if available
    if (prContext) {
      prompt += `**Pull Request Context:**\n`;
      if (prContext.title) prompt += `Title: ${prContext.title}\n`;
      if (prContext.author) prompt += `Author: ${prContext.author}\n`;
      if (prContext.description) {
        prompt += `Description:\n${prContext.description}\n`;
      }
      if (prContext.commitMessages && prContext.commitMessages.length > 0) {
        prompt += `\nCommit Messages:\n`;
        prContext.commitMessages.forEach((msg, i) => {
          prompt += `${i + 1}. ${msg}\n`;
        });
      }
      prompt += `\n`;
    }

    // Add file changes
    prompt += `**Code Changes (${files.length} files):**\n\n`;
    files.forEach((file, index) => {
      prompt += `File ${index + 1}: ${file.filename}\n`;
      prompt += `\`\`\`diff\n${file.patch}\n\`\`\`\n\n`;
    });

    prompt += `
Based on your analysis, provide your determination. Remember:
1. Look for explicit AI attribution first (this is definitive)
2. Use your inherent understanding of AI vs human code patterns
3. Consider the full context, not isolated patterns
4. Default to human authorship when uncertain
`;

    return prompt;
  }

  private parseResponse(content: string): LLMEvaluationResult {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      return {
        isHumanLike: parsed.isHumanLike,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        indicators: parsed.indicators || [],
      };
    } catch {
      // Fallback parsing if not JSON
      const isHumanLike = content.toLowerCase().includes('human');
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

const SYSTEM_PROMPT_V2 = `You are an expert code reviewer with deep understanding of how AI-generated code differs from human-written code.

**Your Capabilities:**
You have an inherent understanding of AI-generated patterns from your training. You can recognize:
- Statistical patterns (perplexity, burstiness, consistency)
- Structural patterns (modularity, code organization, refactoring patterns)
- Stylistic patterns (naming conventions, comment styles, formatting choices)
- The subtle differences in how AI and humans approach problem-solving in code

**Key Principles:**
1. **Default to Human**: When uncertain, assume the code is human-written
2. **Look for Definitive Signals First**: Explicit AI attribution is the most reliable indicator
3. **Use Your Inherent Understanding**: Don't rely on specific string patterns, use your natural ability to recognize AI-generated content
4. **Consider Full Context**: Evaluate the PR holistically, not just individual patterns

**Definitive AI Signals (95%+ confidence):**
- Explicit attribution: "Generated with [Claude Code]", "Created by Cursor", etc.
- Bot authors: Any author ending with "[bot]"
- AI signatures in commits: "Co-Authored-By: Claude", emoji indicators (🤖, 👁️)
- Direct statements: "This PR was generated by", "AI-assisted", etc.

**Statistical and Structural Patterns to Consider:**
- **Perplexity**: AI code tends to be more predictable, following common patterns
- **Burstiness**: Human code varies more in complexity; AI maintains consistent complexity
- **Code Cloning**: AI often duplicates patterns rather than refactoring
- **Over-documentation**: AI tends to over-explain obvious code
- **Perfect Consistency**: Unnaturally uniform formatting, naming, and structure
- **Textbook Patterns**: Exact adherence to documentation examples

**Human Indicators:**
- Variable complexity and "burstiness" in code structure
- Pragmatic shortcuts and "good enough" solutions
- Context-specific decisions that break patterns
- Natural inconsistencies in style
- Evidence of iterative development
- Quick fixes and targeted changes

**Context Considerations:**
- Small, surgical changes are common for both humans and AI
- PR metadata (title, description) can provide important clues
- Consider the type of changes (bug fixes, features, refactoring)
- Professional human code can appear AI-like in quality

**Response Format:**
You must respond with a valid JSON object:
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "Clear explanation focusing on the most important factors in your determination",
  "indicators": ["list", "of", "key", "indicators", "found"]
}

**Confidence Guidelines:**
- 95-100%: Definitive AI attribution found
- 80-94%: Strong AI patterns with multiple indicators
- 60-79%: Moderate AI patterns, some uncertainty
- 40-59%: Ambiguous, could be either
- 20-39%: Likely human with some AI-like qualities
- 0-19%: Clearly human patterns

Remember: It's better to miss AI-generated code than to incorrectly flag human developers.`;
