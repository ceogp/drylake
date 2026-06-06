# Publishing DryLake To Open VSX

Open VSX is the open registry used by VS Code-compatible editors. DryLake should publish the same VSIX used for the Visual Studio Marketplace.

## One-Time Setup

1. Create an Eclipse account.
2. Accept the Open VSX publisher agreement.
3. Create an Open VSX access token.
4. Create or verify the `xupracorp` namespace.

```bash
npx ovsx create-namespace xupracorp -p "$OVSX_TOKEN"
```

The namespace must match the extension `publisher` field:

```json
{
  "publisher": "xupracorp",
  "name": "drylake"
}
```

## Publish

```bash
cd extensions/xupra-drylake-vscode
npm ci
npm run compile
npm run package:vsix
npx ovsx publish drylake-<version>.vsix -p "$OVSX_TOKEN"
```

## CI Publishing

Set `OVSX_TOKEN` in GitLab CI/CD variables. A `drylake-v<version>` tag can then publish the packaged VSIX automatically.

## Verification

After publishing:

1. Open `https://open-vsx.org/extension/xupracorp/drylake`.
2. Confirm the version matches `extensions/xupra-drylake-vscode/package.json`.
3. Install from an Open VSX-compatible editor.
4. Confirm the extension opens the DryLake Control Room and can connect to the DryLake account flow.

