# AI Detection Improvement Plan

## Core Principle
**We must err on the side of NOT failing PRs when uncertain.** It's better to miss some AI-generated code than to block legitimate human developers.

## Current Issues

### 1. Critical Bug: Claude Code Signatures Ignored
- **Problem**: PR #347 had "🤖 Generated with [Claude Code]" but was classified as human (30% confidence)
- **Impact**: Strong AI signals are being detected but not properly acted upon
- **Root Cause**: The confidence adjustment (-50) isn't overriding the decision logic

### 2. Non-Code File Blindness
- **Problem**: LICENSE files, config files, and other non-code files can't be analyzed
- **Impact**: PR #16 (Apache License) was misclassified because no code patterns could be analyzed
- **Example**: Adding a perfectly formatted LICENSE file in one commit is a typical AI pattern

### 3. CI/CD Over-Bias
- **Problem**: CI/CD file changes get -25 confidence adjustment, leading to extreme uncertainty
- **Impact**: PR #404 got only 15% confidence despite having detailed AI-style PR description
- **Reality**: AI tools frequently modify CI/CD files with the same precision as code files

### 4. Inconsistent Results
- **Problem**: Same PR can get vastly different results between runs
- **Impact**: PR #12 went from 25% human (correct) to 85% AI (incorrect)
- **Cause**: LLM non-determinism without proper guardrails

## Proposed Improvements

### 1. Fix Strong Signal Detection (PRIORITY 1)
**Current**: Strong signals are detected but can be overridden
**Fix**: 
- If `hasStrongAISignals()` returns true, ALWAYS return AI classification
- No PR context should override explicit AI tool mentions
- Add early return in `applyPRContextAdjustments()` for strong signals

### 2. Enhance PR-Level Analysis
**Current**: File-level analysis dominates the decision
**Improvements**:
- Analyze PR description structure (markdown sections, checkboxes, formatting)
- Weight commit message patterns more heavily
- Look for AI-typical patterns: perfect grammar, structured sections, no typos

### 3. Special Handling for Non-Code Files
**Current**: Non-code files return empty analysis
**Improvements**:
- For LICENSE/README/config files, rely MORE on PR-level indicators
- Consider the "perfection" of standard file additions (complete licenses in one commit)
- Don't skip analysis just because it's not code

### 4. Adjust Confidence Modifiers
**Current modifiers are too aggressive**:
- CI files: -25 → -10 (still human-leaning but not extreme)
- No description: -20 → -15 (many humans also skip descriptions)
- Perfect commits: -25 → -35 (stronger AI signal)
- Claude signature: -50 → -100 (absolute override)

### 5. Add Deterministic Fallbacks
**For consistent results**:
- If confidence is 40-60%, check for specific patterns
- Count exact indicators and use thresholds
- Add reproducible heuristics alongside LLM analysis

### 6. Improve Confidence Calculation
**Current**: Complex adjustments can conflict
**Improvements**:
- Strong signals should set confidence to 90%+ immediately
- Separate "detection confidence" from "human/AI confidence"
- Make adjustments cumulative but capped

## Implementation Priority

1. **Fix Claude Code signature bug** (Critical - affects trust)
2. **Add PR-level pattern detection** (High - improves accuracy)
3. **Adjust confidence modifiers** (Medium - reduces false positives)
4. **Handle non-code files** (Medium - expands coverage)
5. **Add deterministic checks** (Low - improves consistency)

## Success Metrics

Target after improvements:
- Overall accuracy: >85% (from current 42.9%)
- False positive rate: <5% (protecting human developers)
- False negative rate: <20% (acceptable to miss some AI)
- Confidence correlation: Higher confidence should mean higher accuracy

## Testing Strategy

1. Run current test suite to establish baseline
2. Fix one issue at a time and measure impact
3. Add new test cases for each improvement
4. Ensure no regression in false positive rate
5. Validate with real-world PRs not in training set