# Publishing Workflow

This document describes how to publish new versions of the Only Robots GitHub Action.

## Overview

The action follows semantic versioning and uses a multi-tag system similar to other popular GitHub Actions:

- **Specific version tags**: `v1.0.0`, `v1.1.0`, `v1.1.1` (immutable, points to exact commit)
- **Major version tags**: `v1`, `v2`, `v3` (mutable, points to latest release within major version)

## Publishing Process

### 1. Automated Publishing (Recommended)

The automated publishing workflow is triggered when you create a GitHub release:

> **Note:** Creating a release via CLI or API does NOT automatically publish to GitHub Marketplace. You must manually enable marketplace publishing through the web UI after creating the release.

#### Option A: Using GitHub CLI (Recommended for developers)

```bash
# Create a new release with auto-generated notes
gh release create v1.0.0 --title "v1.0.0 - Release Title" --generate-notes

# Or create with custom notes
gh release create v1.0.0 --title "v1.0.0 - Release Title" --notes "Custom release notes here"

# Or create with notes from a file
gh release create v1.0.0 --title "v1.0.0 - Release Title" --notes-file CHANGELOG.md
```

#### Option B: Using GitHub Web Interface

1. **Create a GitHub Release**:
   - Go to the [Releases page](https://github.com/dcramer/action-onlyrobots/releases)
   - Click "Create a new release"
   - Tag version: `v1.0.0` (use semantic versioning)
   - Generate release notes or write them manually
   - Click "Publish release"

2. **Automatic Processing**:
   - The `release.yml` workflow will automatically:
     - Build the action
     - Run tests and linting
     - Update package.json version
     - Commit built files to the release tag
     - Update the major version tag (e.g., `v1` → `v1.0.0`)

3. **Publishing to GitHub Marketplace** (Manual Step):
   - Navigate to the [Releases page](https://github.com/getsentry/action-onlyrobots/releases)
   - Find your newly created release
   - Click "Edit" on the release
   - Check the box "Publish this Action to the GitHub Marketplace"
   - If first time: Accept the GitHub Marketplace Developer Agreement
   - Click "Update release"
   - Your action will now appear in the GitHub Marketplace!

### 2. Manual Version Tag Updates

If you need to manually update a major version tag to point to a different release:

1. Go to the [Actions tab](https://github.com/dcramer/action-onlyrobots/actions)
2. Select "Update Version Tag" workflow
3. Click "Run workflow"
4. Enter:
   - **Target**: The existing tag to point to (e.g., `v1.0.1`)
   - **Major version**: The major version to update (e.g., `v1`)

## Workflow Files

### `.github/workflows/check-dist.yml`
- Runs on push/PR to main
- Ensures compiled `dist/` directory is up-to-date
- Prevents merging code without proper build artifacts

### `.github/workflows/release.yml`
- Runs when a GitHub release is published
- Builds, tests, and publishes the action
- Updates major version tags automatically

### `.github/workflows/update-version.yml`
- Manual workflow for updating major version tags
- Useful for hotfixes or corrections

## GitHub Marketplace Requirements

For your action to be eligible for the GitHub Marketplace:

1. **Repository Requirements**:
   - Must be a public repository ✅
   - Must contain a single `action.yml` or `action.yaml` at the root ✅
   - Must NOT contain any workflow files in `.github/workflows/` ❌ **Note: This repository contains workflow files which may prevent marketplace publishing**
   - Action name must be unique across all GitHub Marketplace

   > **Important:** The presence of workflow files in `.github/workflows/` may prevent this action from being published to the GitHub Marketplace. Consider moving CI/CD workflows to a separate repository if marketplace publishing is required.

2. **Metadata Requirements** (`action.yml`):
   - `name`: Unique action name
   - `description`: Clear description of what the action does
   - `author`: Your name or organization
   - `branding`: Icon and color for marketplace display
   - Well-documented inputs and outputs

3. **Account Requirements**:
   - Two-factor authentication (2FA) must be enabled
   - Must accept the GitHub Marketplace Developer Agreement

## Pre-Release Checklist

Before creating a release:

1. **Ensure all changes are merged to main**
2. **Run local validation**:
   ```bash
   pnpm run validate
   ```
3. **Test the action locally**:
   ```bash
   pnpm run test-pr
   ```
4. **Verify dist/ is up-to-date**:
   ```bash
   pnpm run build
   git status  # should show no changes in dist/
   ```

## Important: dist/ Directory

**GitHub Actions require the compiled `dist/` directory to be committed to source control.** Unlike typical JavaScript/TypeScript projects where build artifacts are ignored, GitHub Actions run directly from the repository without a build step.

- The `dist/` directory contains compiled JavaScript files that GitHub executes
- `action.yml` points to `dist/index.js` as the main entry point  
- Always run `pnpm run build` after code changes to update `dist/`
- The `check-dist.yml` workflow verifies `dist/` stays in sync with source code

## Version Strategy

### Major Versions (v1, v2, v3)
- Breaking changes
- New required inputs
- Removed functionality
- Major workflow changes

### Minor Versions (v1.1, v1.2)
- New features
- New optional inputs
- Enhanced functionality
- Non-breaking changes

### Patch Versions (v1.1.1, v1.1.2)
- Bug fixes
- Security patches
- Documentation updates
- Performance improvements

## User Consumption

Users can reference the action in multiple ways:

```yaml
# Recommended: Use major version (gets latest patches automatically)
- uses: dcramer/action-onlyrobots@v1

# Specific version (locked to exact release)
- uses: dcramer/action-onlyrobots@v1.0.0

# Development version (not recommended for production)
- uses: dcramer/action-onlyrobots@main
```

## Troubleshooting

### Build Artifacts Out of Date
If the `check-dist.yml` workflow fails:
```bash
pnpm run build
git add dist/
git commit -m "Update build artifacts"
```

### Release Workflow Fails
1. Check that `OPENAI_API_KEY` is set in repository secrets
2. Verify the tag follows semantic versioning (e.g., `v1.0.0`)
3. Ensure all tests pass locally with `pnpm run test`

### Major Version Tag Issues
If a major version tag points to the wrong release:
1. Use the "Update Version Tag" workflow
2. Or manually update via CLI:
   ```bash
   git tag -f v1 v1.0.1
   git push origin v1 --force
   ```

## Why Marketplace Publishing Requires Manual Action

GitHub requires manual intervention for marketplace publishing for security reasons:

1. **2FA Verification**: Publishing to the marketplace requires two-factor authentication verification that can only be done through the web browser
2. **Developer Agreement**: The first marketplace publication requires accepting the GitHub Marketplace Developer Agreement
3. **Security**: This prevents automated scripts from accidentally or maliciously publishing actions to the marketplace

While release creation can be fully automated, the marketplace publishing step must be done manually through the GitHub web interface.

## Security Notes

- Only repository maintainers can create releases
- All builds are performed in GitHub Actions (not local machines)
- Secrets are only accessible to the release workflow
- Built artifacts are committed to release tags, not main branch