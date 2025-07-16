# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Overview

This is a Cloudflare Worker that acts as a GitHub webhook receiver for pull requests. Its purpose is to enforce "agentic development only" by evaluating code changes and determining whether they appear to be written by AI agents rather than humans.

## Repository Structure

```
no-humans-agent/
├── src/
│   ├── index.ts      # Main webhook handler and Cloudflare Worker entry
│   ├── types.ts      # TypeScript interfaces for GitHub webhooks
│   ├── github.ts     # GitHub API integration and webhook verification
│   └── evaluator.ts  # Code evaluation logic to detect human-written code
├── wrangler.toml     # Cloudflare Worker configuration
├── tsconfig.json     # TypeScript configuration
├── biome.json        # Code formatting and linting configuration
└── package.json      # Project dependencies and scripts
```

## Core Components

### Webhook Handler (`src/index.ts`)
- Cloudflare Worker fetch handler
- Processes GitHub pull_request events
- Orchestrates evaluation and reporting

### GitHub Integration (`src/github.ts`)
- Webhook signature verification using HMAC-SHA256
- GitHub API client for fetching PR files
- Check run creation for reporting results

### LLM Evaluator (`src/llm-evaluator.ts`)
- Uses OpenAI GPT-4o-mini for intelligent code analysis
- Detects AI tool attribution (Claude Code, Cursor, etc.)
- Analyzes code patterns, style, and quality indicators
- Provides detailed reasoning and confidence scores

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Deploy to Cloudflare
pnpm run deploy

# Type checking
pnpm run typecheck

# Code formatting and linting
pnpm run lint
pnpm run lint:fix
```

## Code Validation Requirements

**MANDATORY after ANY code changes:**
- Run `pnpm run typecheck` to verify TypeScript compilation
- Run `pnpm run lint` to check code style
- Run `pnpm run test` to verify LLM integration works
- Ensure all lint-staged hooks pass on commit

### Testing Setup

**Required for testing:**
- Create `.env` file with `OPENAI_API_KEY=sk-your-key-here`
- Tests make real OpenAI API calls to validate functionality
- Use `pnpm run test` for full test suite or `pnpm run test:watch` for development

## Configuration

### Environment Variables
- `GITHUB_WEBHOOK_SECRET`: Secret for verifying webhook signatures (optional but recommended)
- `OPENAI_API_KEY`: OpenAI API key for LLM-based code evaluation (required)

### Wrangler Configuration
- Set in `wrangler.toml`
- Use `wrangler secret` for sensitive values

## Code Style Guidelines

- Use Biome for formatting and linting
- Follow TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for functions
- Keep functions focused and single-purpose

## Evaluation Strategy

The LLM evaluator uses OpenAI's GPT-4o-mini to analyze code changes and determine if they appear human or AI-generated:

**Priority Indicators:**
- **AI Tool Attribution**: Direct mentions of "Claude Code", "Cursor", "GitHub Copilot", etc.
- **Commit Messages**: References to AI assistance

**Analysis Criteria:**
- Code style consistency and professionalism
- Comment quality (JSDoc vs casual)
- Debugging artifacts and temporary code
- TypeScript usage patterns
- Error handling and code structure

## Deployment Notes

1. Set required environment variables in Cloudflare:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GITHUB_WEBHOOK_SECRET`: GitHub webhook secret (optional)
2. GitHub webhook should be configured for:
   - Event: Pull requests
   - Actions: opened, synchronize, reopened
3. Worker needs to respond within Cloudflare's timeout limits
4. Consider OpenAI rate limits for high-traffic repositories

## Future Enhancements

Consider adding:
- GitHub App authentication for check runs
- Configurable evaluation rules
- Webhook event filtering
- Result caching for large PRs
- Integration with GitHub Actions

## Security Considerations

- Always verify webhook signatures in production
- Never log or expose secrets
- Validate all incoming data
- Use least-privilege access for GitHub API