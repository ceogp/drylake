$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22 or newer is required before bootstrapping DryLake."
}

node "$PSScriptRoot\scripts\bootstrap-dev.mjs" @args
