# Xupra DryLake VS Code Extension

Editor-first workflow for Xupra DryLake.

## What it does

From VS Code or Cursor, the extension can:

- connect to your Xupra workspace
- detect supported agent files in the current repo
- import the workspace into a package version
- run compatibility checks
- generate export previews
- pull generated files back into the repo
- trigger deployment jobs

## Test In VS Code Extension Host

1. Open `extensions/xupra-drylake-vscode` in VS Code.
2. Run `npm install`.
3. Press `F5`.
4. Choose `Run Xupra Extension`.
5. In the Extension Development Host, open the `Xupra` activity bar.
6. Open `Settings` and set:
   - `xupra.baseUrl`
   - local backend: `http://localhost:3005`
   - staging backend: `http://52.196.86.96`

Recommended settings:

- `xupra.defaultTargetPlatform`
- `xupra.confirmBeforeWriteback`
- `xupra.openDashboardAfterConnect`

## Package For Install Testing

Build a `.vsix`:

```bash
npm run package:vsix
```

Then install it in VS Code with:

- `Extensions: Install from VSIX...`

## Cursor Compatibility

The extension stays within standard VS Code APIs and includes:

```bash
npm run check:cursor
```

Use the same packaged `.vsix` for Cursor testing when compatible.
