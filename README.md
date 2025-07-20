# Only Robots Action

A GitHub Action that evaluates pull requests to ensure code appears to be written by AI agents rather than humans - enforcing "agentic development only" policies.

## Features

- 🤖 **LLM-as-a-Judge**: Uses OpenAI GPT-4o-mini for intelligent code analysis
- 🔍 **AI Tool Detection**: Identifies obvious indicators like "Claude Code", "Cursor", "GitHub Copilot" attribution
- 📊 **Detailed Analysis**: Provides confidence scores and reasoning for each evaluation
- ✅ **GitHub Integration**: Creates check runs with detailed results
- 🚀 **Easy Setup**: Simple GitHub Action configuration

## Usage

Add this action to your workflow file (e.g., `.github/workflows/only-robots.yml`):

```yaml
name: Only Robots Check

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  check-robots:
    runs-on: ubuntu-latest
    steps:
      - name: Only Robots
        uses: getsentry/action-onlyrobots@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          post-comment: true  # Optional: post a fun comment when humans are detected (default: true)
          fail-on-human: false  # Optional: fail the build when humans are detected (default: false)
```

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `openai-api-key` | OpenAI API key for LLM evaluation | Yes | - |
| `pr-number` | Pull request number to evaluate | No | Auto-detected |
| `post-comment` | Post a comment on PR when human code is detected | No | `true` |
| `fail-on-human` | Fail the build when human code is detected | No | `false` |

### Outputs

| Output | Description |
|--------|-------------|
| `result` | Evaluation result (`passed` or `failed`) |
| `confidence` | Confidence score of the evaluation |
| `summary` | Summary of the evaluation |

## Setup

### 1. Add OpenAI API Key

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Add it as a repository secret:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

### 2. Create Workflow File

Create `.github/workflows/only-robots.yml`:

```yaml
name: Only Robots Check

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  check-robots:
    runs-on: ubuntu-latest
    steps:
      - name: Only Robots
        uses: getsentry/action-onlyrobots@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          post-comment: true  # Optional: post a fun comment when humans are detected (default: true)
          fail-on-human: false  # Optional: fail the build when humans are detected (default: false)
```

### 3. Required Permissions

The action requires the following permissions:

- **`contents: read`** - To read repository contents
- **`pull-requests: write`** - To post comments on PRs (when `post-comment: true`)
- **`checks: write`** - To create check runs with detailed results

> **Note**: The `checks: write` permission is only available for workflows triggered by repository events, not from forks. For pull requests from forks, the action will gracefully degrade and skip creating check runs.

### 4. Enable PR Comments (Optional)

To enable fun, helpful comments when human code is detected, set `post-comment: true` in your workflow. The action will post a humorous but informative comment explaining why the code was flagged and how to fix it.

## Development

### Local Development

```bash
# Build the project
pnpm run build

# Run type checking
pnpm run typecheck

# Format and lint code
pnpm run lint
pnpm run lint:fix

# Run tests (requires .env with OPENAI_API_KEY)
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Test a specific PR
pnpm run test-pr https://github.com/owner/repo/pull/123
pnpm run test-pr owner/repo#123 --verbose --show-diffs
```

### CLI Tool for Testing PRs

The project includes a CLI tool for testing PR evaluation locally:

```bash
# Basic usage
pnpm run test-pr https://github.com/getsentry/sentry-mcp/pull/394

# Using shorthand format
pnpm run test-pr getsentry/sentry-mcp#394

# Show detailed analysis for each file
pnpm run test-pr owner/repo#123 --verbose

# Show the actual code diffs being analyzed
pnpm run test-pr owner/repo#123 --verbose --show-diffs

# Output as JSON for automation
pnpm run test-pr owner/repo#123 --format json
```

**CLI Options:**
- `--help` - Show help message
- `--format <format>` - Output format: text (default) or json
- `--github-token` - GitHub token for API access (or set GITHUB_TOKEN env var)
- `--openai-key` - OpenAI API key (or set OPENAI_API_KEY env var)
- `--verbose` - Show detailed analysis for each file
- `--show-diffs` - Show the actual code diffs being analyzed

### Testing

### Evaluation System

We maintain a dataset of real PRs to test detection accuracy:

```bash
# Add PRs to dataset
pnpm run eval add-pr <url> --ai --tool="Claude Code"
pnpm run eval add-pr <url> --human

# Run evaluation
pnpm run eval run
```

See [EVAL.md](EVAL.md) for details.

### Individual PR Testing

The project includes comprehensive tests that validate the LLM evaluation functionality:

1. **Setup**: Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-openai-key-here
   ```

2. **Test Types**:
   - **Unit Tests**: Test individual functions and components
   - **Integration Tests**: Test real OpenAI API calls with various code patterns
   - **End-to-End Tests**: Test complete PR evaluation workflows

3. **Test Coverage**:
   - AI vs human code detection
   - AI tool attribution recognition
   - Multi-file PR evaluation
   - Error handling and edge cases

4. **Running Tests**:
   ```bash
   # Run all tests
   pnpm run test
   
   # Run specific test file
   pnpm exec vitest run src/test/llm-evaluator.test.ts
   
   # Run specific test case
   pnpm exec vitest run -t "should detect AI tool attribution"
   ```

### Git Hooks

The project uses `simple-git-hooks` and `lint-staged` to ensure code quality:

```bash
# Initialize git hooks (run once)
pnpm run prepare
```

## How It Works

### Evaluation Process

1. **Webhook Reception**: Receives GitHub pull request events
2. **File Analysis**: Fetches changed files from the PR
3. **LLM Evaluation**: Sends each file to OpenAI GPT-4o-mini for analysis
4. **Result Aggregation**: Combines individual file results into overall assessment
5. **Reporting**: Creates GitHub Check Runs with detailed results

### Detection Criteria

The LLM evaluator looks for:

**High Priority Indicators:**
- AI tool attribution in commits or comments ("Claude Code", "Cursor", etc.)
- References to AI assistance in commit messages

**Code Quality Patterns:**
- Consistent vs inconsistent formatting
- Professional JSDoc vs casual comments
- Modern TypeScript patterns vs legacy JavaScript
- Proper error handling and code structure
- Debug artifacts (console.log, TODO comments)

### Example Output

```json
{
  "name": "No Humans Agent",
  "head_sha": "abc123",
  "status": "completed",
  "conclusion": "success",
  "output": {
    "title": "✅ Code appears to be AI-generated",
    "summary": "Analyzed 3 file(s) in this pull request.\n\n**Overall Assessment:** All files appear to be AI-generated with consistent patterns typical of AI-assisted development.\n\n**Confidence:** 85.0%",
    "text": "## All files appear to be AI-generated 🤖\n\n### File Analysis Summary:\n- **src/utils.ts**: 90.0% confidence AI-generated\n- **src/types.ts**: 85.0% confidence AI-generated\n- **src/main.ts**: 80.0% confidence AI-generated"
  }
}
```

## Configuration Options

### Model Selection

The evaluator uses `gpt-4o-mini` by default. You can modify this in `src/llm-evaluator.ts`:

```typescript
const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini', // or 'gpt-4o', 'gpt-3.5-turbo', etc.
  // ...
});
```

### Supported File Types

The system analyzes these file extensions:
- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- Python: `.py`
- Other languages: `.java`, `.cpp`, `.c`, `.h`, `.cs`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`, `.php`
- Frontend: `.vue`, `.svelte`, `.astro`
- Configuration: `.json`, `.yaml`, `.yml`

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is required" error**
   - Ensure you've set the OpenAI API key as a GitHub secret or in your `.env` file

2. **Rate limiting errors**
   - The action may hit OpenAI rate limits for very large PRs
   - Consider using the CLI tool to test specific PRs during development

3. **GitHub API errors**
   - Ensure the GitHub token has appropriate permissions
   - For private repositories, you may need to provide a personal access token

### Debugging

Use the CLI tool to test and debug PR evaluation:
```bash
# Test with verbose output
pnpm run test-pr owner/repo#123 --verbose

# Show actual diffs being analyzed
pnpm run test-pr owner/repo#123 --show-diffs

# Get JSON output for detailed analysis
pnpm run test-pr owner/repo#123 --format json
```

## Future Enhancements

- Configurable evaluation rules and scoring
- Support for more file types and languages
- Batch processing for large PRs
- Caching for improved performance
- Webhook support for real-time evaluation
- Custom AI model selection via configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm run lint` to ensure code quality
5. Submit a pull request

## License

Apache-2.0