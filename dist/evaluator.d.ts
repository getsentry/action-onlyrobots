interface EvaluationResult {
    isHumanLike: boolean;
    confidence: number;
    reasons: string[];
    patterns: string[];
}
export declare function evaluateCode(code: string, _filename: string): EvaluationResult;
export {};
//# sourceMappingURL=evaluator.d.ts.map