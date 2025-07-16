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

export interface FileAnalysis {
  filename: string;
  patch: string;
  result: LLMEvaluationResult;
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

  async evaluateFile(filename: string, patch: string): Promise<LLMEvaluationResult> {
    const prompt = this.buildEvaluationPrompt(filename, patch);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
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
      // Fallback to assuming human-written on error
      return {
        isHumanLike: true,
        confidence: 50,
        reasoning: `Error during evaluation: ${error}`,
        indicators: ['evaluation-error'],
      };
    }
  }

  async evaluatePullRequest(files: FileToEvaluate[]): Promise<{
    overallResult: LLMEvaluationResult;
    fileResults: FileAnalysis[];
  }> {
    const fileResults: FileAnalysis[] = [];

    // Evaluate each file
    for (const file of files) {
      const result = await this.evaluateFile(file.filename, file.patch);
      fileResults.push({
        filename: file.filename,
        patch: file.patch,
        result,
      });
    }

    // Aggregate results
    const humanLikeFiles = fileResults.filter((f) => f.result.isHumanLike);
    const avgConfidence =
      fileResults.reduce((sum, f) => sum + f.result.confidence, 0) / fileResults.length;

    const overallResult: LLMEvaluationResult = {
      isHumanLike: humanLikeFiles.length > 0,
      confidence: avgConfidence,
      reasoning: this.buildOverallReasoning(fileResults, humanLikeFiles),
      indicators: this.aggregateIndicators(fileResults),
    };

    return {
      overallResult,
      fileResults,
    };
  }

  private buildEvaluationPrompt(filename: string, patch: string): string {
    const isDistFile =
      filename.startsWith('dist/') || filename.startsWith('lib/') || filename.startsWith('build/');
    const isDocFile =
      filename.endsWith('.md') || filename.endsWith('.txt') || filename.includes('README');
    const isConfigFile =
      filename.includes('.json') ||
      filename.includes('.yml') ||
      filename.includes('.yaml') ||
      filename.includes('.toml');

    return `Analyze this code change and determine if it appears to be written by a human or an AI agent.

**File:** ${filename}
${isDistFile ? '**NOTE:** This is a build artifact/compiled file.' : ''}
${isDocFile ? '**NOTE:** This is a documentation file.' : ''}
${isConfigFile ? '**NOTE:** This is a configuration file.' : ''}

**Code Changes:**
\`\`\`diff
${patch}
\`\`\`

Focus on:
1. **Obvious AI tool indicators**: Comments or metadata mentioning "Claude Code", "Cursor", "Copilot", "ChatGPT", etc.
2. **File context**: Build artifacts, documentation, and config files are often AI-generated when well-structured
3. **Code style patterns**: Consistent formatting, proper TypeScript usage, good naming
4. **Comment quality**: Professional JSDoc vs casual comments  
5. **Debugging artifacts**: console.log statements, temporary variables, TODO comments
6. **Code structure**: Well-organized imports, proper error handling
7. **Change patterns**: Systematic, cohesive changes vs ad-hoc fixes

Respond with your analysis in the exact format specified in the system prompt.`;
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
        indicators: this.extractIndicators(content),
      };
    }
  }

  private extractIndicators(content: string): string[] {
    const indicators: string[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('claude code') || lowerContent.includes('cursor')) {
      indicators.push('ai-tool-attribution');
    }
    if (lowerContent.includes('debug') || lowerContent.includes('console.log')) {
      indicators.push('debug-statements');
    }
    if (lowerContent.includes('todo') || lowerContent.includes('fixme')) {
      indicators.push('todo-comments');
    }
    if (lowerContent.includes('typescript') || lowerContent.includes('types')) {
      indicators.push('typescript-usage');
    }
    if (lowerContent.includes('consistent') || lowerContent.includes('formatted')) {
      indicators.push('consistent-formatting');
    }

    return indicators;
  }

  private buildOverallReasoning(
    fileResults: FileAnalysis[],
    humanLikeFiles: FileAnalysis[]
  ): string {
    const totalFiles = fileResults.length;
    const humanFiles = humanLikeFiles.length;

    if (humanFiles === 0) {
      return `All ${totalFiles} file(s) appear to be AI-generated. Code shows consistent patterns typical of AI-assisted development.`;
    }

    if (humanFiles === totalFiles) {
      return `All ${totalFiles} file(s) appear to be human-written. Code shows characteristics typical of human development patterns.`;
    }

    return `Mixed results: ${humanFiles} of ${totalFiles} file(s) appear human-written. This suggests a combination of human and AI contribution.`;
  }

  private aggregateIndicators(fileResults: FileAnalysis[]): string[] {
    const allIndicators = fileResults.flatMap((f) => f.result.indicators);
    return [...new Set(allIndicators)];
  }
}

const SYSTEM_PROMPT = `You are an expert code reviewer tasked with determining whether code changes appear to be written by a human developer or an AI agent/tool.

**CRITICAL INDICATORS:**
1. **AI Tool Attribution**: Any mention of "Claude Code", "Cursor", "GitHub Copilot", "ChatGPT", "Claude", or similar AI tools is a strong indicator of AI-generated code
2. **Commit Messages**: References to AI assistance in commit messages  
3. **Code Comments**: AI tools often leave specific comment patterns or references

**SPECIAL CASES TO CONSIDER:**
- **Build artifacts** (files in dist/, lib/, build/ directories): These are compiled outputs and should generally be considered AI-generated if they're well-structured
- **Large file additions**: Multiple new files added at once often indicates tooling or AI assistance
- **Documentation updates**: Professional, well-structured documentation often indicates AI assistance
- **Configuration changes**: Clean, consistent config updates often indicate AI assistance

**ANALYSIS CRITERIA:**

**Human-Written Code Indicators:**
- Debug statements like console.log("test"), console.log("here")
- TODO/FIXME comments with casual language
- Inconsistent formatting or spacing
- Generic variable names (foo, bar, test, temp)  
- Incomplete implementations or quick fixes
- Casual or inconsistent commenting style
- Using older JavaScript patterns (var instead of let/const)
- Trailing whitespace or formatting inconsistencies
- Manual, ad-hoc fixes or workarounds

**AI-Generated Code Indicators:**
- Consistent, professional formatting
- Proper TypeScript usage with explicit types
- Well-structured imports and exports
- Professional JSDoc comments
- Comprehensive error handling
- Descriptive variable and function names
- Modern JavaScript/TypeScript patterns
- Clean, production-ready code structure
- Systematic approach to changes
- Professional documentation style
- Multiple related files changed cohesively

**RESPONSE FORMAT:**
You must respond with a valid JSON object in this exact format:
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "Detailed explanation of your analysis",
  "indicators": ["list", "of", "specific", "indicators", "found"]
}

**IMPORTANT:**
- Be decisive but nuanced in your analysis
- Consider the context of the file type and changes
- Weight obvious indicators (AI tool mentions) heavily
- A single strong indicator can override multiple weak ones
- If unsure, err on the side of human-written (confidence around 50)`;
