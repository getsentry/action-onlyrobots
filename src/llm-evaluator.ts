import OpenAI from 'openai';

// Constants for evaluation
const AI_INDICATORS = {
  STRONG_SIGNALS: [
    'ai attribution',
    'ai tool',
    'claude',
    'cursor',
    'copilot',
    '🤖',
    'co-authored-by',
  ],
  FORMATTING: ['formatting-fix', 'precision-changes', 'consistent-formatting'],
  CLAUDE_CODE_SPECIFIC: ['🤖 generated with', 'claude code', 'noreply@anthropic.com'],
} as const;

const CONFIDENCE_ADJUSTMENTS = {
  NO_DESCRIPTION: -10, // Reduced penalty - AI can generate PRs without descriptions but it's less common
  FORMATTING_WITH_CONTEXT: -5, // Keep small penalty for formatting-only changes
  PERFECT_COMMITS: -20, // Reduced - many humans use conventional commits
  VERBOSE_NAMING: -30, // AI often uses overly descriptive names
  COMPREHENSIVE_COMMENTS: -25, // AI tends to over-comment
} as const;

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

export interface PRContext {
  title?: string;
  description?: string;
  commitMessages?: string[];
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

  async evaluatePullRequest(
    files: FileToEvaluate[],
    prContext?: PRContext
  ): Promise<{
    overallResult: LLMEvaluationResult;
    fileResults: FileAnalysis[];
  }> {
    // Evaluate each file individually
    const fileResults = await this.evaluateFiles(files);

    // Check for strong AI signals in files
    if (this.hasStrongAISignals(fileResults)) {
      return this.buildAIDetectedResult(fileResults);
    }

    // Check for strong AI signals in PR context (Claude Code signature, etc.)
    if (prContext && this.hasStrongPRSignals(prContext)) {
      return this.buildAIDetectedResult(fileResults, prContext);
    }

    // Apply PR context adjustments for ambiguous cases
    return this.applyPRContextAdjustments(fileResults, prContext);
  }

  private async evaluateFiles(files: FileToEvaluate[]): Promise<FileAnalysis[]> {
    const fileResults: FileAnalysis[] = [];

    for (const file of files) {
      const result = await this.evaluateFile(file.filename, file.patch);
      fileResults.push({
        filename: file.filename,
        patch: file.patch,
        result,
      });
    }

    return fileResults;
  }

  private hasStrongAISignals(fileResults: FileAnalysis[]): boolean {
    return fileResults.some((f) =>
      f.result.indicators.some((indicator) => {
        const indLower = indicator.toLowerCase();
        // Check general AI signals
        const hasGeneralSignal = AI_INDICATORS.STRONG_SIGNALS.some((signal) =>
          indLower.includes(signal)
        );
        // Check Claude Code specific patterns
        const hasClaudeCodeSignal = AI_INDICATORS.CLAUDE_CODE_SPECIFIC.some((signal) =>
          indLower.includes(signal.toLowerCase())
        );
        return hasGeneralSignal || hasClaudeCodeSignal;
      })
    );
  }

  private hasStrongPRSignals(prContext: PRContext): boolean {
    // Check for Claude Code signature in commit messages or PR description
    const hasClaudeSignature =
      (prContext.commitMessages?.some(
        (msg) =>
          msg.includes('🤖') ||
          msg.includes('Claude Code') ||
          msg.includes('Co-Authored-By: Claude') ||
          msg.includes('Generated with [Claude Code]')
      ) ??
        false) ||
      (prContext.description?.includes('Claude Code') ?? false) ||
      (prContext.description?.includes('🤖') ?? false);

    // Check for other AI tool mentions
    const hasAIToolMention =
      prContext.commitMessages?.some((msg) =>
        AI_INDICATORS.STRONG_SIGNALS.some((signal) => msg.toLowerCase().includes(signal))
      ) ?? false;

    if (prContext.description) {
      const descLower = prContext.description.toLowerCase();
      if (AI_INDICATORS.STRONG_SIGNALS.some((signal) => descLower.includes(signal))) {
        return true;
      }
    }

    return hasClaudeSignature || hasAIToolMention;
  }

  private buildAIDetectedResult(
    fileResults: FileAnalysis[],
    prContext?: PRContext
  ): {
    overallResult: LLMEvaluationResult;
    fileResults: FileAnalysis[];
  } {
    const humanLikeFiles = fileResults.filter((f) => f.result.isHumanLike);
    const avgConfidence =
      fileResults.reduce((sum, f) => sum + f.result.confidence, 0) / fileResults.length;

    const aiTools = this.extractAITools(fileResults);
    let reasoning = `Strong AI attribution detected. `;

    // Add specific reason for detection
    if (prContext && this.hasStrongPRSignals(prContext)) {
      reasoning +=
        'PR context explicitly mentions AI tool usage (Claude Code, Cursor, Copilot, etc.).';
    } else {
      const aiFileCount = fileResults.length - humanLikeFiles.length;
      reasoning += `${aiFileCount} file(s) contain AI tool references${
        aiTools.length > 0 ? ` (${aiTools.join(', ')})` : ''
      }.`;
    }

    const indicators = [...this.aggregateIndicators(fileResults)];

    // Add PR context indicators if available
    if (prContext) {
      const prIndicators = this.analyzePRContext(fileResults, prContext);
      indicators.push(...prIndicators.indicators);
    }

    return {
      overallResult: {
        isHumanLike: false,
        confidence: Math.max(avgConfidence, 90), // Very high confidence for strong signals
        reasoning,
        indicators,
      },
      fileResults,
    };
  }

  private applyPRContextAdjustments(
    fileResults: FileAnalysis[],
    prContext?: PRContext
  ): {
    overallResult: LLMEvaluationResult;
    fileResults: FileAnalysis[];
  } {
    const humanLikeFiles = fileResults.filter((f) => f.result.isHumanLike);
    const aiFiles = fileResults.filter((f) => !f.result.isHumanLike);

    // Calculate weighted confidence based on file results
    let avgConfidence =
      fileResults.reduce((sum, f) => sum + f.result.confidence, 0) / fileResults.length;

    // Analyze PR description for AI patterns
    const prDescAnalysis = this.analyzePRDescription(prContext?.description);

    // More sophisticated decision logic:
    // - Majority of files must be AI-generated to flag as AI
    // - Consider confidence levels
    // - PR description patterns can influence decision
    let isHumanLike = true; // Default to human

    // Special handling for non-code files (LICENSE, configs, etc.)
    const isNonCodePR = fileResults.every(
      (f) =>
        f.filename.match(/\.(md|txt|LICENSE|json|ya?ml|toml)$/i) ||
        f.filename.includes('LICENSE') ||
        f.result.indicators.length === 0
    );

    if (isNonCodePR && prDescAnalysis.isAIStyled) {
      // For non-code files, rely heavily on PR-level analysis
      isHumanLike = false;
      avgConfidence = Math.max(avgConfidence, prDescAnalysis.confidence);
    } else if (aiFiles.length > humanLikeFiles.length) {
      // Majority are AI files
      const aiConfidenceAvg =
        aiFiles.reduce((sum, f) => sum + f.result.confidence, 0) / aiFiles.length;

      // Only flag as AI if AI files have high confidence
      if (aiConfidenceAvg > 75) {
        isHumanLike = false;
      }
    } else if (prDescAnalysis.isAIStyled && avgConfidence < 50) {
      // Files are ambiguous but PR description is AI-styled
      isHumanLike = false;
      avgConfidence = Math.max(avgConfidence, prDescAnalysis.confidence * 0.8);
    }

    // Apply PR context adjustments
    if (prContext) {
      const prIndicators = this.analyzePRContext(fileResults, prContext);

      // PR context can push borderline cases toward human
      if (!isHumanLike && prIndicators.indicators.length >= 3) {
        // Strong PR signals for human authorship
        if (avgConfidence < 80) {
          // Only override if not super confident about AI
          isHumanLike = true;
          avgConfidence = Math.max(
            0,
            Math.min(100, avgConfidence + prIndicators.confidenceAdjustment)
          );
        }
      }

      const reasoning = this.buildContextAwareReasoning(
        fileResults,
        humanLikeFiles,
        prIndicators,
        prContext
      );

      return {
        overallResult: {
          isHumanLike,
          confidence: isHumanLike ? 100 - avgConfidence : avgConfidence,
          reasoning,
          indicators: [
            ...this.aggregateIndicators(fileResults),
            ...prIndicators.indicators,
            ...prDescAnalysis.indicators,
          ],
        },
        fileResults,
      };
    }

    // Default case - no PR context
    const reasoning = this.buildOverallReasoning(fileResults, humanLikeFiles);

    return {
      overallResult: {
        isHumanLike,
        confidence: isHumanLike ? 100 - avgConfidence : avgConfidence,
        reasoning,
        indicators: this.aggregateIndicators(fileResults),
      },
      fileResults,
    };
  }

  private analyzePRContext(
    fileResults: FileAnalysis[],
    prContext?: PRContext
  ): { indicators: string[]; confidenceAdjustment: number } {
    const indicators: string[] = [];
    let confidenceAdjustment = 0;

    if (!prContext) {
      return { indicators, confidenceAdjustment };
    }

    // Check for minimal/no description
    if (!prContext.description || prContext.description.trim() === '') {
      indicators.push('no-pr-description');
      confidenceAdjustment += CONFIDENCE_ADJUSTMENTS.NO_DESCRIPTION;
    }

    // Note: Removed terse title check - AI commonly uses fix/update/correct prefixes too

    // Note: Removed CI/CD bias - AI can generate any type of file including CI/CD workflows

    // Check for verbose naming patterns (AI indicator)
    if (this.hasVerboseNamingPatterns(fileResults)) {
      indicators.push('verbose-naming-patterns');
      confidenceAdjustment += CONFIDENCE_ADJUSTMENTS.VERBOSE_NAMING;
    }

    // Check for comprehensive commenting (AI indicator)
    if (this.hasComprehensiveComments(fileResults)) {
      indicators.push('comprehensive-commenting');
      confidenceAdjustment += CONFIDENCE_ADJUSTMENTS.COMPREHENSIVE_COMMENTS;
    }

    // Check for formatting-only changes with human context
    if (this.areFormattingOnlyChanges(fileResults) && indicators.length > 0) {
      indicators.push('formatting-fixes-with-human-context');
      confidenceAdjustment += CONFIDENCE_ADJUSTMENTS.FORMATTING_WITH_CONTEXT;
    }

    // Check for perfect conventional commits - strong AI signal
    if (prContext.commitMessages && prContext.commitMessages.length > 2) {
      const conventionalCommitPattern =
        /^(feat|fix|chore|docs|style|refactor|test|build|perf|ci)(\(.+\))?: .+/;
      const allConventional = prContext.commitMessages.every((msg) => {
        const firstLine = msg.split('\n')[0];
        return conventionalCommitPattern.test(firstLine);
      });

      if (allConventional) {
        indicators.push('perfect-conventional-commits');
        confidenceAdjustment += CONFIDENCE_ADJUSTMENTS.PERFECT_COMMITS;
      }
    }

    // Check for Claude Code signature
    if (
      prContext.commitMessages?.some(
        (msg) =>
          msg.includes('🤖') ||
          msg.includes('Claude Code') ||
          msg.includes('Co-Authored-By: Claude')
      )
    ) {
      indicators.push('claude-code-signature');
      confidenceAdjustment -= 100; // Absolute AI signal - should never be overridden
    }

    return { indicators, confidenceAdjustment };
  }

  private areFormattingOnlyChanges(fileResults: FileAnalysis[]): boolean {
    return fileResults.every((f) =>
      f.result.indicators.some((ind) =>
        AI_INDICATORS.FORMATTING.some((format) => ind.toLowerCase().includes(format))
      )
    );
  }

  private hasVerboseNamingPatterns(fileResults: FileAnalysis[]): boolean {
    // Check if multiple files mention verbose naming
    const verboseCount = fileResults.filter((f) =>
      f.result.indicators.some(
        (ind) =>
          ind.toLowerCase().includes('verbose') ||
          ind.toLowerCase().includes('overly descriptive') ||
          ind.toLowerCase().includes('userAccountInformation') ||
          ind.toLowerCase().includes('formatUserDisplayName')
      )
    ).length;

    return verboseCount >= 2 || (verboseCount === 1 && fileResults.length === 1);
  }

  private hasComprehensiveComments(fileResults: FileAnalysis[]): boolean {
    // Check if files have comprehensive commenting patterns
    const commentCount = fileResults.filter((f) =>
      f.result.indicators.some(
        (ind) =>
          (ind.toLowerCase().includes('comprehensive') && ind.toLowerCase().includes('comment')) ||
          ind.toLowerCase().includes('jsdoc') ||
          ind.toLowerCase().includes('detailed comments') ||
          ind.toLowerCase().includes('extensive documentation')
      )
    ).length;

    return commentCount >= 2 || (commentCount === 1 && fileResults.length === 1);
  }

  private analyzePRDescription(description?: string): {
    isAIStyled: boolean;
    indicators: string[];
    confidence: number;
  } {
    if (!description || description.trim() === '') {
      return { isAIStyled: false, indicators: [], confidence: 0 };
    }

    const indicators: string[] = [];
    let aiScore = 0;

    // Check for structured markdown sections
    if (description.includes('## Summary') || description.includes('## Changes')) {
      indicators.push('structured-markdown-sections');
      aiScore += 20;
    }

    // Check for task list with checkboxes
    if (description.match(/- \[x\]/g)?.length ?? 0 >= 2) {
      indicators.push('checkbox-task-list');
      aiScore += 15;
    }

    // Check for perfect formatting and grammar
    const hasBulletPoints = (description.match(/^- /gm)?.length ?? 0) >= 2;
    const hasNoTypos = !description.match(/\b(teh|taht|thsi|wiht|becuase|recieve)\b/i);
    const hasConsistentFormatting = description
      .split('\n')
      .every((line) => line.trim() === '' || line.match(/^(#+\s|[-*]\s|\d+\.\s|\s{2,})/));

    if (hasBulletPoints && hasNoTypos && hasConsistentFormatting) {
      indicators.push('perfect-formatting');
      aiScore += 20;
    }

    // Check for comprehensive test plan
    if (description.match(/test plan|testing/i) && description.includes('[x]')) {
      indicators.push('comprehensive-test-plan');
      aiScore += 15;
    }

    // Check for AI-typical phrasing
    const aiPhrases = [
      'ensure proper',
      'compliance',
      'best practices',
      'comprehensive',
      'robust',
      'scalable',
      'maintainable',
      'optimized',
    ];
    const phraseMatches = aiPhrases.filter((phrase) =>
      description.toLowerCase().includes(phrase)
    ).length;
    if (phraseMatches >= 2) {
      indicators.push('ai-typical-phrasing');
      aiScore += 10;
    }

    return {
      isAIStyled: aiScore >= 40,
      indicators,
      confidence: Math.min(aiScore, 95),
    };
  }

  private extractAITools(fileResults: FileAnalysis[]): string[] {
    const aiTools = new Set<string>();

    for (const file of fileResults) {
      const reasoning = file.result.reasoning.toLowerCase();
      if (reasoning.includes('claude')) aiTools.add('Claude Code');
      if (reasoning.includes('cursor')) aiTools.add('Cursor');
      if (reasoning.includes('copilot')) aiTools.add('GitHub Copilot');
    }

    return Array.from(aiTools);
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

  private buildContextAwareReasoning(
    fileResults: FileAnalysis[],
    humanLikeFiles: FileAnalysis[],
    prIndicators: { indicators: string[]; confidenceAdjustment: number },
    _prContext?: PRContext
  ): string {
    const totalFiles = fileResults.length;
    const humanFiles = humanLikeFiles.length;

    let reasoning = '';

    // Add PR context analysis if applicable
    if (prIndicators.indicators.length > 0) {
      reasoning += 'PR-level analysis suggests human authorship: ';

      // Add human pattern indicators to reasoning
      if (prIndicators.indicators.includes('no-pr-description')) {
        reasoning += 'No PR description provided (typical of quick human fixes). ';
      }
      if (prIndicators.indicators.includes('formatting-fixes-with-human-context')) {
        reasoning += 'Formatting-only changes in human context. ';
      }
      if (prIndicators.indicators.includes('ci-workflow-changes-only')) {
        reasoning += 'Changes only affect CI/CD workflows (commonly human debugging). ';
      }
      reasoning += '\n\n';
    }

    // Add file-level analysis
    if (humanFiles === 0 && prIndicators.indicators.length === 0) {
      reasoning += `All ${totalFiles} file(s) show consistent AI-generation patterns.`;
    } else if (humanFiles === totalFiles) {
      reasoning += `All ${totalFiles} file(s) appear to be human-written based on code analysis.`;
    } else {
      reasoning += `File analysis: ${humanFiles} of ${totalFiles} file(s) appear human-written. `;
      reasoning += 'Combined with PR context, this suggests human authorship.';
    }

    return reasoning;
  }

  private buildEvaluationPrompt(filename: string, patch: string): string {
    const fileType = this.getFileType(filename);

    return `Analyze this code change and determine if it appears to be written by a human or an AI agent.

**File:** ${filename}
${fileType.notes ? `**NOTE:** ${fileType.notes}` : ''}

**Code Changes:**
\`\`\`diff
${patch}
\`\`\`

Analyze the code looking for these specific signals:

**CRITICAL SIGNALS (99% confidence if found):**
- Direct mentions of AI tools in comments, commit messages, or code
- Claude Code signature: "🤖 Generated with [Claude Code](https://claude.ai/code)"
- Co-authored-by tags: "Co-Authored-By: Claude <noreply@anthropic.com>"
- Other AI tool mentions: Cursor, GitHub Copilot, ChatGPT
- Commit messages with perfect conventional commit format adherence across multiple commits

**STRUCTURAL FINGERPRINTS (85-95% confidence):**
- Unnaturally perfect formatting consistency across the entire change
- Overly descriptive, pattern-consistent variable naming throughout
- Rigid adherence to textbook code organization
- All comments following identical formatting style
- Repetitive code structures across different sections

**PRECISION INDICATORS (Confidence varies by context):**
- Single-character formatting fixes (adding newlines, spaces, commas) - 75-90% AI confidence UNLESS:
  - PR has minimal/no description (suggests quick human fix)
  - Changes are in CI/CD files (humans often make targeted workflow fixes)
  - PR title suggests bug fix or correction (e.g., "Fix", "Correct", "Update")
- Surgical precision changes with no side effects - Consider context
- Minimal, targeted fixes to specific issues - Common in both human and AI work
- Changes that follow exact patterns - Could be human applying consistent fix
- Simple string literal modifications - Often human corrections

**STYLISTIC PATTERNS (70-85% confidence):**
- Comments explaining obvious code functionality  
- Comprehensive error handling on every function
- Consistent use of latest/modern language patterns throughout
- Perfect adherence to documentation examples
- Overly descriptive naming for simple concepts (e.g., "userDisplayNameString", "formatUserDisplayNameWithEmailAddress")
- Verbose parameter names with unnecessary detail (e.g., "userAccountInformation" instead of "user")
- Systematic multi-file refactoring with consistent patterns (agent.py, config.py, tools.py structure)
- Multi-step solutions with detailed PR descriptions explaining problem/solution/testing
- Perfect modular architecture across related files

**CONTEXT-AWARE EVALUATION:**
- Consider the PR title and description - minimal or terse descriptions often indicate human quick fixes
- CI/CD workflow files (.github/workflows, etc.) are frequently fixed by humans with targeted changes
- "Fix", "Correct", "Update" in PR titles often indicate human intervention
- Small formatting changes in workflow files are commonly human-made to fix broken builds
- Lack of verbose commit messages or descriptions can indicate human authorship

**FOCUS ON DETECTING OBVIOUS AI PATTERNS:**
- Look for CRITICAL SIGNALS first - these are definitive
- Multiple STRUCTURAL FINGERPRINTS together suggest AI generation
- PRECISION INDICATORS must be evaluated WITH PR context - not in isolation
- STYLISTIC PATTERNS may support AI detection but are not decisive alone
- Small, surgical changes are common in BOTH human fixes and AI assistance
- Absence of human indicators does NOT mean it's AI-generated
- Professional, clean code is often written by skilled human developers

**IMPORTANT: When evaluating minimal PRs with formatting changes:**
- If PR has no description and title suggests a fix -> likely human
- If changes are in CI/CD files -> likely human (humans often debug workflows)
- If commit message is terse -> likely human
- Default to human authorship for ambiguous cases

Respond with your analysis in the exact format specified in the system prompt.`;
  }

  private getFileType(filename: string): { type: string; notes: string } {
    if (
      filename.startsWith('dist/') ||
      filename.startsWith('lib/') ||
      filename.startsWith('build/')
    ) {
      return { type: 'build', notes: 'This is a build artifact/compiled file.' };
    }
    if (filename.endsWith('.md') || filename.endsWith('.txt') || filename.includes('README')) {
      return { type: 'doc', notes: 'This is a documentation file.' };
    }
    if (
      filename.includes('.json') ||
      filename.includes('.yml') ||
      filename.includes('.yaml') ||
      filename.includes('.toml')
    ) {
      return { type: 'config', notes: 'This is a configuration file.' };
    }
    if (filename.includes('.github/workflows') || filename.includes('ci/')) {
      return {
        type: 'ci',
        notes: 'This is a CI/CD workflow file - humans often make targeted fixes here.',
      };
    }
    return { type: 'code', notes: '' };
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

    const indicatorMap = {
      'ai-tool-attribution': ['claude code', 'cursor'],
      'debug-statements': ['debug', 'console.log'],
      'todo-comments': ['todo', 'fixme'],
      'typescript-usage': ['typescript', 'types'],
      'consistent-formatting': ['consistent', 'formatted'],
      'precision-changes': ['surgical', 'precision', 'targeted'],
      'formatting-fix': ['newline', 'formatting fix'],
      'verbose-naming': ['verbose', 'descriptive naming', 'overly descriptive'],
    };

    for (const [indicator, patterns] of Object.entries(indicatorMap)) {
      if (patterns.some((pattern) => lowerContent.includes(pattern))) {
        indicators.push(indicator);
      }
    }

    return indicators;
  }

  private aggregateIndicators(fileResults: FileAnalysis[]): string[] {
    const allIndicators = fileResults.flatMap((f) => f.result.indicators);
    return [...new Set(allIndicators)];
  }
}

const SYSTEM_PROMPT = `You are an expert code reviewer tasked with determining whether code changes appear to be written by a human developer or an AI agent/tool.

**CRITICAL DETECTION SIGNALS (High Confidence):**
1. **Direct AI Attribution**: Any mention of "Claude Code", "Cursor", "GitHub Copilot", "ChatGPT", "Claude", "Copilot", or similar AI tools in comments, commit messages, or code
2. **Claude Code Signatures**: 
   - "🤖 Generated with [Claude Code](https://claude.ai/code)" in commit messages
   - "Co-Authored-By: Claude <noreply@anthropic.com>" in commits
   - Robot emoji (🤖) in commit messages is highly indicative
3. **AI Commit Message Patterns**: Perfect conventional commit format (feat:, fix:, chore:, docs:, style:, refactor:, test:, build:) across ALL commits in a PR
4. **Co-authored by AI**: Commit metadata showing AI pair programming or co-authorship

**STRUCTURAL FINGERPRINTS (Medium-High Confidence):**
1. **Unnaturally Consistent Formatting**: Perfect indentation, spacing, and alignment across entire files
2. **Predictable Variable Naming**: Overly descriptive, consistent naming patterns (e.g., "userProfileData", "calculateTotalAmount") 
3. **Rigid Code Structure**: Highly organized imports, perfect separation of concerns, textbook-style organization
4. **Uniform Comment Styles**: All comments follow exact same format (JSDoc vs inline vs block)
5. **Pattern Repetition**: Identical code structures repeated across different functions/files

**PRECISION INDICATORS (Medium-High Confidence):**
1. **Surgical Formatting Changes**: Single-character fixes like adding newlines, spaces, or punctuation
2. **Targeted Corrections**: Minimal changes that fix specific issues without touching surrounding code
3. **Pattern-Based Fixes**: Consistent application of the same small change across multiple locations
4. **Zero Side Effects**: Changes that only address the stated problem with no extra modifications
5. **Formatting Consistency**: Changes that make formatting perfectly uniform across similar structures

**STYLISTIC PATTERNS (Medium Confidence):**
1. **Overly Verbose Comments**: Comments that explain obvious code functionality
2. **Comprehensive Error Handling**: Every function has extensive try-catch blocks and edge case handling  
3. **Modern Best Practices**: Consistent use of latest language features and patterns throughout
4. **Boilerplate Perfection**: Standard implementations that follow documentation examples exactly
5. **Descriptive Everything**: Variable names, function names, and comments are all extremely descriptive
6. **Verbose Naming**: Names like "userDisplayNameString", "formatUserDisplayNameWithEmailAddress", "userAccountInformation" instead of simpler alternatives

**HUMAN-WRITTEN INDICATORS (Higher probability of human authorship):**
1. **Debug Artifacts**: console.log("here"), console.log("debug"), temporary print statements
2. **Casual Comments**: "// TODO: fix this later", "// hack for now", "// not sure why this works"
3. **Inconsistent Naming**: Mix of naming conventions (camelCase, snake_case, abbreviations)
4. **Quick Fixes**: Hardcoded values, magic numbers, copy-pasted code blocks
5. **Formatting Inconsistencies**: Mixed indentation, irregular spacing, trailing whitespace
6. **Incomplete Implementations**: Placeholder functions, commented-out code, partial features
7. **Ad-hoc Solutions**: Unusual or creative approaches to common problems
8. **Legacy Patterns**: Use of older syntax (var, function declarations) mixed with modern code

**STATISTICAL INDICATORS:**
- **Low Perplexity**: AI code tends to be more predictable in structure and word choice
- **Uniform Burstiness**: AI maintains consistent complexity/verbosity levels
- **Pattern Rigidity**: Exact adherence to style guides without human variation

**RESPONSE FORMAT:**
You must respond with a valid JSON object in this exact format:
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "Detailed explanation of your analysis",
  "indicators": ["list", "of", "specific", "indicators", "found"]
}

**IMPORTANT ANALYSIS GUIDELINES:**
- **Default assumption: Code is human-written unless proven otherwise**
- Only flag as AI-generated when you have STRONG evidence (80%+ confidence)
- CRITICAL SIGNALS (99%) are definitive - always flag these as AI
- Multiple STRUCTURAL FINGERPRINTS (85-95%) together may indicate AI
- STYLISTIC PATTERNS alone are not sufficient - these are common in professional code
- When uncertain, err on the side of human authorship (confidence 40-60%)
- Better to miss some AI code than falsely flag human developers
- Focus on detecting obvious AI patterns, not ruling out human authorship

**CONTEXT-AWARE EVALUATION RULES:**
1. **Consider the full context** - don't evaluate changes in isolation
2. **Surgical changes WITHOUT other AI indicators** should default to human authorship
3. **Empty PR descriptions** can suggest quick human fixes
4. **AI-specific patterns to look for**:
   - Verbose naming (userAccountInformation, formatUserDisplayNameWithEmailAddress)
   - Over-commenting and excessive documentation
   - Perfect JSDoc on every function
   - Overly descriptive variable names for simple concepts

**When you see formatting-only changes:**
- Only flag as AI if you see OTHER strong AI indicators
- Formatting changes alone are not enough to determine AI authorship`;
