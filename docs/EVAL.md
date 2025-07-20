# Evaluation System

This system tests our AI detection accuracy using real GitHub PRs.

## Quick Start

```bash
# Add PRs to test dataset
pnpm run eval add-pr https://github.com/org/repo/pull/123 --ai --tool="Claude Code"
pnpm run eval add-pr https://github.com/org/repo/pull/456 --human

# Run evaluation
pnpm run eval run

# View dataset
pnpm run eval stats
pnpm run eval list
```

## How it Works

1. **Real PRs as fixtures**: Each PR is stored as JSON in `src/test/datasets/real-prs/`
2. **Expected outcomes**: Each PR is labeled as AI/Human with tool info
3. **Evaluation**: Runs our LLM evaluator against all PRs and reports accuracy

## Commands

- `add-pr <url>`: Add a PR with `--ai` or `--human` flag
  - `--tool`: Specify AI tool (e.g., "Claude Code", "Cursor")
  - `--notes`: Add context for tricky cases
- `run`: Evaluate all PRs, shows accuracy metrics
- `stats`: Dataset statistics
- `list`: List all PRs in dataset

## Files

- `src/eval/`: Evaluation CLI and runner
- `src/test/datasets/real-prs/`: PR fixtures (one per file)
- `eval-results/`: Evaluation run results