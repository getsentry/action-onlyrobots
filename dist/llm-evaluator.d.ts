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
export declare class LLMEvaluator {
    private openai;
    constructor(config: {
        OPENAI_API_KEY: string;
    });
    evaluateFile(filename: string, patch: string): Promise<LLMEvaluationResult>;
    evaluatePullRequest(files: FileToEvaluate[]): Promise<{
        overallResult: LLMEvaluationResult;
        fileResults: FileAnalysis[];
    }>;
    private buildEvaluationPrompt;
    private parseResponse;
    private extractIndicators;
    private buildOverallReasoning;
    private aggregateIndicators;
}
//# sourceMappingURL=llm-evaluator.d.ts.map