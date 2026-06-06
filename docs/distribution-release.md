# DryLake Distribution Release Plan

DryLake should ship as one extension build across three distribution paths:

1. Visual Studio Marketplace for normal VS Code users.
2. Open VSX for VS Code-compatible ecosystems.
3. Cursor distribution through VSIX install today and Cursor plugin/MCP packaging as the next path.

The extension identity must stay stable:

- Publisher: `xupracorp`
- Extension name: `drylake`
- Marketplace ID: `xupracorp.drylake`

## Release Contract

Every release should:

1. Build the extension once.
2. Package one VSIX from `extensions/xupra-drylake-vscode`.
3. Publish that same VSIX to Visual Studio Marketplace.
4. Publish that same VSIX to Open VSX.
5. Upload that same VSIX as a Cursor-installable release artifact.
6. Package the Cursor plugin scaffold with the same version number.
7. Publish or package the MCP server when Agent Preflight is part of the release.

## Required CI Variables

Set these once in GitLab CI/CD variables:

- `VSCE_PAT` or `VSCE_TOKEN`: Visual Studio Marketplace publisher token.
- `OVSX_TOKEN`: Open VSX access token.

Optional:

- `CURSOR_PLUGIN_PUBLISH_URL`: future Cursor plugin publishing endpoint if Cursor provides a direct submission API.
- `NPM_TOKEN`: npm publish token for `@xupracorp/drylake-mcp` once the MCP server is ready for public release.

The current pipeline packages Cursor artifacts but does not publish directly into Cursor Marketplace because Cursor plugin publication currently depends on Cursor marketplace/repository submission and approval.

## Release Command

Create a tag:

```bash
git tag drylake-v0.6.51
git push origin drylake-v0.6.51
```

The tag pipeline will:

- validate the app,
- package the VSIX,
- package the Cursor plugin scaffold,
- publish to Visual Studio Marketplace when a VSCE token is configured,
- publish to Open VSX when an OVSX token is configured,
- keep Cursor artifacts available from the pipeline/package output.

## Local Verification

```powershell
npm run check:distribution
npm --prefix extensions/xupra-drylake-vscode run check:marketplace
npm --prefix extensions/xupra-drylake-vscode run check:cursor
npm --prefix extensions/xupra-drylake-vscode run typecheck
npm --prefix extensions/xupra-drylake-vscode test
npm run package:extension
```

## Platform Notes

- Visual Studio Marketplace uses `vsce publish`.
- Open VSX uses `ovsx publish`; the namespace must match the extension `publisher`.
- Cursor users can install the VSIX manually today. The Cursor plugin scaffold is prepared for the MCP/Agent Preflight product path.
