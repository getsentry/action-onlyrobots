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
            content: REVERSED_HEURISTIC_PROMPT,
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
      // Default to AI on error (following reversed heuristic)
      return {
        isHumanLike: false,
        confidence: 50,
        reasoning: `Evaluation error: ${error}. Defaulting to AI authorship.`,
        indicators: ['evaluation-error'],
      };
    }
  }

  private buildPrompt(files: FileToEvaluate[], prContext?: PRContext): string {
    const parts: string[] = [];

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
        isHumanLike: parsed.isHumanLike ?? false, // Default to AI
        confidence: parsed.confidence ?? 75,
        reasoning: parsed.reasoning ?? 'Unable to parse reasoning',
        indicators: parsed.indicators ?? [],
      };
    } catch {
      // Default to AI-generated on parse error
      return {
        isHumanLike: false,
        confidence: 75,
        reasoning: content,
        indicators: ['parse-error'],
      };
    }
  }
}

const REVERSED_HEURISTIC_PROMPT = `You are an expert at detecting human-written code. Your job is to find STRONG EVIDENCE of human authorship.

# CRITICAL RULE: DEFAULT TO AI-GENERATED

**ASSUME ALL CODE IS AI-GENERATED UNLESS YOU FIND STRONG HUMAN EVIDENCE**

This is a reversed heuristic. Good formatting, coherent commit messages, and clean code are EXPECTED from AI. They are NOT evidence of human authorship.

# PRIORITY 1: EXPLICIT AI ATTRIBUTION (OVERRIDES EVERYTHING)

If ANY of these are present, it's DEFINITELY AI (95%+ confidence):
- "*This PR was created with Claude Code*"
- "*Generated with Claude Code*"
- "🤖 Generated with [Claude Code]"
- "Co-Authored-By: Claude <noreply@anthropic.com>"
- "*This PR was created with Cursor*"
- "Created by Seer"
- Author ends with [bot] (e.g., "dependabot[bot]", "seer-by-sentry[bot]")
- Any explicit statement of AI generation in description or commits

**IMPORTANT**: These attributions OVERRIDE ALL OTHER EVIDENCE. Even if the PR looks human in every other way, explicit attribution means it's AI.

# PRIORITY 2: STRONG EVIDENCE FOR HUMAN (MUST HAVE ONE OR MORE)

## 1. Personal Voice in Commits/PR
- Shorthand: "fix fubar cache", "goddamn cors again"
- Team references: "as discussed with @john", "per standup"
- Frustration: "third time's the charm", "actually fix this time"
- Casual language: "lol", "wtf", "idk why this works"
- Typos/informal: "udpate", "fxi", "chagne"

## 2. Messy/Minimal Descriptions
- Empty PR description
- Single line: "fixes #123"
- Informal: "fixes the thing, again lol"
- Stream of consciousness: "ok so the problem was..."
- Missing punctuation, capitalization

## 3. Code Shows Human Struggles
- Platform hacks: "// Works on Safari but not Chrome"
- Defensive coding: "// Don't ask why we need this timeout"
- TODO/FIXME: "// TODO: figure out why this breaks on prod"
- Workarounds: "// Ugly hack but deadline is tomorrow"
- Debug remnants: console.log("HERE"), commented failed attempts

## 4. Project-Specific Weirdness
- Non-standard patterns: "We always use _foo for private"
- Team conventions: "// Using Bob's wrapper as usual"
- Legacy compatibility: "// Keep for backwards compat with v1"
- Business logic: "// CEO wants exactly 7, don't change"

## 5. Iterative Development
- Commit sequence: "add feature" → "fix typo" → "actually fix" → "revert" → "try different approach"
- Small incremental changes with testing
- Commits at odd hours suggesting real work sessions
- Mix of feature + immediate bugfix commits

# NOT ENOUGH TO PROVE HUMAN

These are BASELINE AI outputs, don't be fooled:
- Clean conventional commits ("feat:", "fix:", "chore:")
- Well-structured PR descriptions
- Good code formatting
- Comprehensive test coverage
- Professional language
- No typos
- Logical commit progression

# EVALUATION APPROACH

1. **FIRST check for explicit AI attribution - if found, it's AI (95%+ confidence)**
2. **Otherwise, start with assumption: This is AI-generated**
3. **Look for STRONG human evidence only**
4. **Ignore all "professional" qualities - AI does those**
5. **Need CLEAR human evidence to override default**

# QUICK DECISION RULE

- Explicit AI attribution = **AI** (no matter what)
- Polished + Generic + Coherent = **AI** (default)
- Weird + Ugly + Oddly Specific = **Maybe Human**
- No strong human evidence = **AI** (stay with default)

**Response Format (JSON):**
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "What evidence did you find? (check attribution first!)",
  "indicators": ["explicit-attribution", "personal-voice", "messy-description", "human-struggles", etc.]
}

Remember: Check for AI attribution FIRST. When in doubt, it's AI. Humans leave weird traces. AI doesn't.`;
