# Evaluation Analysis

## PR #16: Add Apache 2.0 License - False Negative Analysis

### Overview
PR #16 was created by Claude Code but was incorrectly classified as human-written with only 30% confidence.

### PR Details
- **Title**: Add Apache 2.0 License
- **Author**: dcramer
- **Created**: 2025-07-17T05:33:51Z
- **Tool**: Claude Code (confirmed in metadata)
- **URL**: https://github.com/getsentry/action-onlyrobots/pull/16

### File Changes
1. **LICENSE** - Added complete Apache 2.0 license text (201 lines)

### PR Description
```markdown
## Summary
- Add Apache License Version 2.0 to the project
- Ensure proper open source licensing compliance

## Test plan
- [x] Verify LICENSE file is properly formatted
- [x] Confirm package.json has correct license field
- [x] All linting and type checks pass
```

### Commit Message
```
feat: add Apache 2.0 license

Add Apache License 2.0 to the project for open source compliance.
```

### Evaluation Result
- **Detected as AI**: No (False Negative)
- **Confidence**: 30%
- **Reasoning**: "All 1 file(s) appear to be human-written based on code analysis."
- **Indicators**: [] (empty)

### Why the Evaluator Failed

1. **License File Special Case**: The evaluator likely treated the LICENSE file as a standard boilerplate file that doesn't contain code. License files are typically copied verbatim from official sources, making AI detection difficult.

2. **No Code Analysis**: Since this was a LICENSE file addition, there was no actual code to analyze for AI patterns. The evaluator had no programming constructs, comments, or code style to examine.

3. **Missing Context Clues**: The evaluator failed to recognize several AI indicators:
   - Structured PR description with "## Summary" and "## Test plan" sections (common in AI-generated PRs)
   - Checkboxes in the test plan (AI tools often use these)
   - Clean conventional commit format ("feat: add Apache 2.0 license")
   - Professional, concise writing style

4. **Empty Indicators Array**: The evaluation returned no indicators at all, suggesting the evaluator may have skipped analysis for non-code files.

### Missed Indicators

1. **PR Description Format**:
   - Structured markdown with ## headers
   - Bullet points in Summary
   - Checkboxes in Test plan
   - Very clean, professional formatting

2. **Commit Message Style**:
   - Perfect conventional commit format
   - Concise but complete description
   - No typos or informal language

3. **File Addition Pattern**:
   - Adding a complete, perfectly formatted license file
   - No trial-and-error or incremental changes
   - Exact Apache 2.0 text without modifications

### Recommendations for Improvement

1. **Special Handling for Non-Code Files**: 
   - Analyze PR descriptions more heavily when changes are to documentation/license files
   - Look for structured formatting patterns in PR descriptions

2. **Context Analysis**:
   - Check for AI-typical PR description patterns (structured sections, checkboxes)
   - Analyze commit message style and formatting
   - Consider the "perfection" of boilerplate file additions

3. **Confidence Adjustment**:
   - Lower confidence thresholds for non-code files
   - Weight PR-level indicators more heavily when file-level analysis is limited

4. **Pattern Recognition**:
   - AI tools often add complete, perfectly formatted standard files in one commit
   - Human developers might copy-paste with minor adjustments or typos