# Implementation Plan: AI Detection Improvements

## Overview
This plan addresses the critical issues found in our AI detection system while maintaining our core principle: **err on the side of not failing PRs when uncertain**.

## Phase 1: Critical Bug Fix (Immediate)

### Task 1.1: Fix Claude Code Signature Detection
**Problem**: Strong AI signals like "🤖 Generated with [Claude Code]" are detected but not properly acted upon.

**Implementation**:
1. Modify `applyPRContextAdjustments()` to check for strong signals first
2. If any strong AI indicators exist, immediately return AI classification with high confidence
3. Prevent PR context from overriding explicit AI signatures

**Code Changes**:
- `src/llm-evaluator.ts`: Add early return for strong signals
- Ensure `hasStrongAISignals()` results are respected

**Test Case**: PR #347 should be correctly identified as AI

### Task 1.2: Fix Confidence Calculation for Strong Signals
**Problem**: Confidence adjustments aren't properly influencing decisions

**Implementation**:
1. When strong signals detected, set base confidence to 90%+
2. Make Claude Code signature adjustment -100 (absolute indicator)
3. Ensure confidence adjustments actually affect the `isHumanLike` decision

## Phase 2: Enhanced Detection Logic (High Priority)

### Task 2.1: Add PR-Level Pattern Detection
**Problem**: File-level analysis dominates, missing obvious PR-level AI patterns

**Implementation**:
1. Create new method `analyzePRPatterns()` that checks:
   - Structured markdown in PR description (## Summary, ## Test plan)
   - Perfect grammar and formatting
   - Checkbox lists with consistent formatting
   - AI-typical commit message patterns

2. Weight PR-level indicators more heavily in decisions

**New Indicators**:
- `structured-pr-description`
- `perfect-markdown-formatting`
- `ai-style-commit-messages`
- `comprehensive-pr-description`

### Task 2.2: Improve Non-Code File Handling
**Problem**: LICENSE, config files return empty analysis

**Implementation**:
1. Create `analyzeNonCodeFile()` method for special file types
2. For non-code files, increase weight of PR-level analysis
3. Recognize patterns like:
   - Adding complete standard licenses in one commit
   - Perfect JSON/YAML formatting
   - Comprehensive config file additions

**File Types to Handle**:
- LICENSE files
- Package.json, tsconfig.json, etc.
- README.md and documentation
- CI/CD workflow files

## Phase 3: Calibration and Consistency (Medium Priority)

### Task 3.1: Adjust Confidence Modifiers
**Current → New Values**:
```typescript
CONFIDENCE_ADJUSTMENTS = {
  NO_DESCRIPTION: -20 → -15,        // Less aggressive
  TERSE_TITLE: -15 → -10,          // Less aggressive  
  CI_FILES_ONLY: -25 → -10,        // Much less aggressive
  FORMATTING_ONLY: -10 → -5,       // Less aggressive
  PERFECT_COMMITS: -25 → -35,      // More aggressive (AI signal)
  CLAUDE_CODE_SIGNATURE: -50 → -100 // Absolute indicator
}
```

### Task 3.2: Add Deterministic Fallbacks
**Problem**: LLM non-determinism causes inconsistent results

**Implementation**:
1. Add pattern counting for reproducible results
2. Create fallback heuristics for 40-60% confidence range
3. Use exact string matching for known patterns

**Deterministic Checks**:
- Exact AI tool name matching
- Commit message pattern regex
- File change pattern analysis
- PR template detection

## Phase 4: Testing and Validation

### Task 4.1: Create Comprehensive Test Suite
1. Add test cases for each fixed issue
2. Ensure no regression in false positive rate
3. Test with PRs not in current dataset

### Task 4.2: Measure Impact
**Metrics to Track**:
- Overall accuracy (target: >85%)
- False positive rate (target: <5%)
- False negative rate (target: <20%)
- Confidence correlation with accuracy

### Task 4.3: Run Evaluation After Each Change
```bash
# Baseline
pnpm run eval

# After each improvement
pnpm run eval > eval-results/improvement-X.txt
```

## Implementation Order

1. **Day 1: Critical Fixes**
   - Fix Claude Code signature bug (1.1)
   - Fix confidence calculation (1.2)
   - Run evaluation, measure improvement

2. **Day 2: Enhanced Detection**
   - Add PR-level patterns (2.1)
   - Improve non-code handling (2.2)
   - Run evaluation, measure improvement

3. **Day 3: Calibration**
   - Adjust modifiers (3.1)
   - Add deterministic checks (3.2)
   - Run full test suite

4. **Day 4: Validation**
   - Comprehensive testing (4.1)
   - Impact measurement (4.2)
   - Documentation updates

## Success Criteria

1. **Must Have**:
   - Claude Code signatures always detected
   - False positive rate <5%
   - No regression in human PR detection

2. **Should Have**:
   - Overall accuracy >85%
   - Consistent results for same PR
   - Better non-code file handling

3. **Nice to Have**:
   - Detailed confidence explanations
   - Tool-specific detection improvements
   - Performance optimizations

## Risk Mitigation

1. **Testing Strategy**: Test each change in isolation
2. **Rollback Plan**: Git commits for each phase
3. **Monitoring**: Track evaluation metrics after each change
4. **Documentation**: Update CLAUDE.md with each improvement

## Next Steps

1. Start with Phase 1 (Critical Bug Fix)
2. Run evaluation after each fix
3. Document results in PR description
4. Get feedback before moving to next phase