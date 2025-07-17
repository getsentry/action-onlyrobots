Create a new release of this GitHub Action

Follow the instructions in PUBLISHING.md to create a new release of this project.

You should simply do a minor version bump. e.g. if the current release is v1.0.0, the next release should be v1.1.0.

To identify the current release, use the GitHub CLI to check the latest release:
```bash
gh release view --json tagName --jq .tagName
```

If no releases exist yet, the first release should be v1.0.0.

IF YOU CANNOT IDENTIFY THE CURRENT RELEASE, THEN YOU SHOULD ABORT.
