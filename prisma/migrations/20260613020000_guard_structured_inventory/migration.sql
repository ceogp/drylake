ALTER TABLE "GuardScan"
  ADD COLUMN "extensionsJson" JSONB,
  ADD COLUMN "mcpServersJson" JSONB,
  ADD COLUMN "workspaceSurfaceJson" JSONB,
  ADD COLUMN "packageManagersJson" JSONB,
  ADD COLUMN "packageScriptsJson" JSONB;
