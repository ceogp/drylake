# Xupra DryLake Extension Plan

## Goal

Build a VS Code extension first, with Cursor compatibility through standard VS Code extension APIs.

The extension is the operator workflow.

The website remains the control plane for:

- authentication
- billing
- credential vault
- deployment target setup
- reporting
- integrations

## Architecture

### Source of truth

The backend API remains the system of record.

The extension is a client for:

- browsing projects, packages, and versions
- scanning local workspaces
- uploading/importing files
- checking compatibility
- generating export previews
- pulling generated files
- triggering deployments

### Extension layers

- `extension host`
  - command registration
  - tree view registration
  - state wiring
- `services`
  - backend API client
  - session/bootstrap
  - workspace scanning
  - file upload
  - file sync
  - job polling
- `views`
  - project/package/version tree
  - recent jobs tree
  - status bar entry
- `webviews`
  - only for preview/diff when needed

## Folder structure

```text
extensions/
  xupra-drylake-vscode/
    package.json
    tsconfig.json
    esbuild.mjs
    .vscodeignore
    README.md
    src/
      extension.ts
      commands/
        connect.ts
        importWorkspace.ts
        checkCompatibility.ts
        exportPreview.ts
        deploy.ts
        pullPackage.ts
        refreshProjects.ts
        openWebApp.ts
      views/
        projectTreeProvider.ts
        jobTreeProvider.ts
        statusBar.ts
      services/
        apiClient.ts
        session.ts
        workspaceScanner.ts
        fileUploader.ts
        fileSync.ts
        jobPoller.ts
        stateStore.ts
      types/
        api.ts
        jobs.ts
        package.ts
      utils/
        errors.ts
        files.ts
        logging.ts
        paths.ts
```

## Commands

- `Xupra DryLake: Connect`
- `Xupra DryLake: Open Web App`
- `Xupra DryLake: Refresh Projects`
- `Xupra DryLake: Select Project`
- `Xupra DryLake: Select Package`
- `Xupra DryLake: Select Version`
- `Xupra DryLake: Scan Workspace`
- `Xupra DryLake: Import Workspace`
- `Xupra DryLake: Check Compatibility`
- `Xupra DryLake: Export Preview`
- `Xupra DryLake: Pull Package Files`
- `Xupra DryLake: Deploy`
- `Xupra DryLake: Show Recent Jobs`

## Manifest contributions

- `activationEvents`
  - `onStartupFinished`
  - command activations for core commands
  - view activations for project and job trees
- `viewsContainers.activitybar`
  - `Xupra DryLake`
- `views`
  - `xupra.projects`
  - `xupra.jobs`
- `commands`
  - command registrations above
- `menus`
  - tree actions and view title actions
- `configuration`
  - `xupra.baseUrl`
  - `xupra.devEmail`
  - `xupra.devDisplayName`
  - `xupra.autoScanOnOpen`
  - `xupra.defaultTargetPlatform`
  - `xupra.pullGeneratedFilesAfterExport`
  - `xupra.logLevel`

## Backend contract for the extension

Use these current routes first:

- `GET /api/v1/auth/session`
- `POST /api/v1/extension/connect`
- `GET /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `GET /api/v1/packages/:packageId`
- `GET /api/v1/versions/:versionId`
- `POST /api/v1/versions/:versionId/files`
- `POST /api/v1/versions/:versionId/import`
- `POST /api/v1/versions/:versionId/compatibility`
- `POST /api/v1/versions/:versionId/export-preview`
- `GET /api/v1/versions/:versionId/exports`
- `POST /api/v1/versions/:versionId/deploy`
- `GET /api/v1/projects/:projectId/deployment-targets`
- `GET /api/v1/deployment-jobs/:jobId`

## MVP scope

The first extension launch should support:

1. connect to backend
2. browse projects/packages/versions
3. scan repo for supported agent files
4. upload/import workspace files
5. run compatibility check
6. generate export preview
7. trigger deployment
8. view recent jobs

## Build order

### Phase 1

- scaffold extension package
- add manifest contributions
- add API client
- add connect command

### Phase 2

- add project/package/version tree
- add refresh command
- add persistent selection state

### Phase 3

- add workspace scanner
- add file upload and import flow

### Phase 4

- add compatibility and export preview flow

### Phase 5

- add pull/writeback flow

### Phase 6

- add deploy flow and job polling

### Phase 7

- test in Cursor
- run `npm run check:cursor`
- polish UX
- package for publishing
