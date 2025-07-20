# PR Evaluation Dataset

This directory contains the evaluation datasets for testing AI code detection accuracy.

## Adding Real PR Examples

### Quick Start

1. **Add a single PR:**
```bash
# AI-generated PR
pnpm run eval:add-pr https://github.com/org/repo/pull/123 --ai --tool="Claude Code"

# Human-written PR
pnpm run eval:add-pr https://github.com/org/repo/pull/456 --human
```

2. **Bulk add from file:**
```bash
pnpm run eval:add-pr bulk examples/pr-list.txt
```

3. **Check dataset stats:**
```bash
pnpm run eval:stats
```

### PR List Format

Create a text file with one PR per line:
```
URL,ai/human,tool,confidence,notes
https://github.com/org/repo/pull/123,ai,Claude Code,95,Systematic refactoring
https://github.com/org/repo/pull/456,human,,,Quick typo fix
```

### Categories

PRs are automatically organized by category:
- `claude-code-prs.json` - Claude Code generated PRs
- `cursor-prs.json` - Cursor AI generated PRs  
- `copilot-prs.json` - GitHub Copilot PRs
- `human-prs.json` - Human-written PRs
- `unknown-ai-prs.json` - AI without specific tool attribution

### Running Evaluations

```bash
# Run all evaluations
pnpm run test:eval

# Run only real PR evaluations
pnpm run test:eval src/test/real-pr.eval.ts

# Watch mode for development
pnpm run test:eval:watch
```

### Best Practices

1. **Add diverse examples**: Include edge cases, ambiguous PRs, and clear examples
2. **Document uncertainty**: Use the notes field to explain why a PR might be tricky
3. **Set realistic confidence**: Don't expect 100% confidence on ambiguous cases
4. **Include context**: PR descriptions and commit messages are important signals

### Validation

Validate all PR examples are properly formatted:
```bash
pnpm run eval:validate
```

### Tips for Finding Good Examples

1. **Claude Code PRs**: Search for "🤖 Generated with Claude Code" on GitHub
2. **Human PRs**: Look for typo fixes, hotfixes, CI updates
3. **Edge cases**: Professional refactoring, well-documented human code
4. **Tool-specific**: Search commit messages for "Co-authored-by: Copilot"