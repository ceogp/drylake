# DryLake Release Automation

DryLake releases should keep the same extension version and behavior across:

- Visual Studio Marketplace
- Open VSX
- Cursor install artifacts and Cursor plugin submission package

## GitLab Pipeline Jobs

The release pipeline adds these jobs:

- `package_extension_distribution`
- `publish_vs_marketplace`
- `publish_open_vsx`
- `publish_cursor_artifacts`

`package_extension_distribution` creates:

- `release/drylake-<version>.vsix`
- `release/drylake-cursor-plugin-<version>.tgz`

The publish jobs use those exact artifacts.

## Required Secrets

Set in GitLab CI/CD variables:

- `VSCE_PAT` or `VSCE_TOKEN`
- `OVSX_TOKEN`
- `NPM_TOKEN`

Tag pipelines intentionally fail if these are missing so a release cannot silently skip one of the automatic publish targets.

## Tag Naming

Use:

```text
drylake-v0.6.51
```

The tag version should match `extensions/xupra-drylake-vscode/package.json`.

## Cursor Limitation

Cursor extension users can install the VSIX immediately. Cursor Marketplace plugin publishing is not wired as a blind automatic upload because Cursor currently requires plugin repository submission and review through `https://cursor.com/marketplace/publish`. The pipeline packages the plugin repository shape so it is ready for submission and release.
