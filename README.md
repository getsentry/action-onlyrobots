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

jobs:
  check-robots:
    runs-on: ubuntu-latest
    steps:
      - name: Only Robots
        uses: getsentry/action-onlyrobots@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `openai-api-key` | OpenAI API key for LLM evaluation | Yes | - |
| `pr-number` | Pull request number to evaluate | No | Auto-detected |

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

jobs:
  check-robots:
    runs-on: ubuntu-latest
    steps:
      - name: Only Robots
        uses: getsentry/action-onlyrobots@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

### 3. Enable Check Runs

The action automatically creates GitHub check runs with detailed results. No additional configuration needed!

## Development

### Local Development

```bash
# Start development server
pnpm run dev

# Run type checking
pnpm run typecheck

# Format and lint code
pnpm run lint
pnpm run lint:fix
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
5. **Reporting**: Logs detailed results (GitHub Check Runs in future versions)

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
- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`
- Python: `.py`
- Other languages: `.java`, `.cpp`, `.c`, `.h`, `.cs`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`, `.php`
- Frontend: `.vue`, `.svelte`, `.astro`

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is required" error**
   - Ensure you've set the OpenAI API key in Cloudflare Workers environment

2. **Webhook signature verification fails**
   - Check that `GITHUB_WEBHOOK_SECRET` matches between GitHub and Cloudflare
   - Ensure webhook payload URL is correct

3. **Worker timeout errors**
   - Large PRs may hit Cloudflare's timeout limits
   - Consider implementing file batching or async processing

### Debugging

Check worker logs in Cloudflare Dashboard:
1. Go to Workers & Pages → no-humans-agent
2. Click "View" → "Logs"
3. Monitor real-time logs during webhook events

## Future Enhancements

- GitHub App integration for proper Check Runs
- Configurable evaluation rules and scoring
- Support for more file types and languages
- Batch processing for large PRs
- Caching for improved performance
- Integration with GitHub Actions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm run lint` to ensure code quality
5. Submit a pull request

## License

Apache-2.0