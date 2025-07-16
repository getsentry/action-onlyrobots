"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMEvaluator = void 0;
const openai_1 = __importDefault(require("openai"));
class LLMEvaluator {
    constructor(config) {
        if (!config.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is required');
        }
        this.openai = new openai_1.default({
            apiKey: config.OPENAI_API_KEY,
        });
    }
    async evaluateFile(filename, patch) {
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
        }
        catch (error) {
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
    async evaluatePullRequest(files) {
        const fileResults = [];
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
        const avgConfidence = fileResults.reduce((sum, f) => sum + f.result.confidence, 0) / fileResults.length;
        const overallResult = {
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
    buildEvaluationPrompt(filename, patch) {
        const isDistFile = filename.startsWith('dist/') || filename.startsWith('lib/') || filename.startsWith('build/');
        const isDocFile = filename.endsWith('.md') || filename.endsWith('.txt') || filename.includes('README');
        const isConfigFile = filename.includes('.json') ||
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

Analyze the code looking for these specific signals:

**CRITICAL SIGNALS (99% confidence if found):**
- Direct mentions of AI tools in comments, commit messages, or code
- Commit messages with perfect conventional commit format adherence  
- Co-authored-by tags indicating AI pair programming

**STRUCTURAL FINGERPRINTS (85-95% confidence):**
- Unnaturally perfect formatting consistency across the entire change
- Overly descriptive, pattern-consistent variable naming throughout
- Rigid adherence to textbook code organization
- All comments following identical formatting style
- Repetitive code structures across different sections

**STYLISTIC PATTERNS (70-85% confidence):**
- Comments explaining obvious code functionality
- Comprehensive error handling on every function
- Consistent use of latest/modern language patterns throughout
- Perfect adherence to documentation examples
- Overly descriptive naming for simple concepts

**FOCUS ON DETECTING OBVIOUS AI PATTERNS:**
- Look for CRITICAL SIGNALS first - these are definitive
- Multiple STRUCTURAL FINGERPRINTS together suggest AI generation
- STYLISTIC PATTERNS may support AI detection but are not decisive alone
- Absence of human indicators does NOT mean it's AI-generated
- Professional, clean code is often written by skilled human developers

Respond with your analysis in the exact format specified in the system prompt.`;
    }
    parseResponse(content) {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(content);
            return {
                isHumanLike: parsed.isHumanLike,
                confidence: parsed.confidence,
                reasoning: parsed.reasoning,
                indicators: parsed.indicators || [],
            };
        }
        catch {
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
    extractIndicators(content) {
        const indicators = [];
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
    buildOverallReasoning(fileResults, humanLikeFiles) {
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
    aggregateIndicators(fileResults) {
        const allIndicators = fileResults.flatMap((f) => f.result.indicators);
        return [...new Set(allIndicators)];
    }
}
exports.LLMEvaluator = LLMEvaluator;
const SYSTEM_PROMPT = `You are an expert code reviewer tasked with determining whether code changes appear to be written by a human developer or an AI agent/tool.

**CRITICAL DETECTION SIGNALS (High Confidence):**
1. **Direct AI Attribution**: Any mention of "Claude Code", "Cursor", "GitHub Copilot", "ChatGPT", "Claude", "Copilot", or similar AI tools in comments, commit messages, or code
2. **AI Commit Message Patterns**: Auto-generated commit messages with phrases like "feat:", "fix:", "refactor:" following conventional commit formats too precisely
3. **Co-authored by AI**: Commit metadata showing AI pair programming or co-authorship

**STRUCTURAL FINGERPRINTS (Medium-High Confidence):**
1. **Unnaturally Consistent Formatting**: Perfect indentation, spacing, and alignment across entire files
2. **Predictable Variable Naming**: Overly descriptive, consistent naming patterns (e.g., "userProfileData", "calculateTotalAmount") 
3. **Rigid Code Structure**: Highly organized imports, perfect separation of concerns, textbook-style organization
4. **Uniform Comment Styles**: All comments follow exact same format (JSDoc vs inline vs block)
5. **Pattern Repetition**: Identical code structures repeated across different functions/files

**STYLISTIC PATTERNS (Medium Confidence):**
1. **Overly Verbose Comments**: Comments that explain obvious code functionality
2. **Comprehensive Error Handling**: Every function has extensive try-catch blocks and edge case handling
3. **Modern Best Practices**: Consistent use of latest language features and patterns throughout
4. **Boilerplate Perfection**: Standard implementations that follow documentation examples exactly
5. **Descriptive Everything**: Variable names, function names, and comments are all extremely descriptive

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
- Focus on detecting obvious AI patterns, not ruling out human authorship`;
//# sourceMappingURL=llm-evaluator.js.map