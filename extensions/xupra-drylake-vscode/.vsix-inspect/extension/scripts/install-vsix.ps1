$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionRoot = Resolve-Path (Join-Path $scriptDir "..")

function Resolve-CodeCliPath {
  $preferredPaths = @(
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
    "$env:ProgramFiles(x86)\Microsoft VS Code\bin\code.cmd"
  )

  foreach ($candidate in $preferredPaths) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  $codeCmd = Get-Command code.cmd -ErrorAction SilentlyContinue
  if ($codeCmd) {
    return $codeCmd.Source
  }

  $code = Get-Command code -ErrorAction SilentlyContinue
  if ($code) {
    return $code.Source
  }

  throw "Could not find VS Code CLI (`"code`"). Install VS Code and ensure code command is available."
}

$latestVsix = Get-ChildItem -Path $extensionRoot -Filter "drylake-*.vsix" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latestVsix) {
  throw "No VSIX file found in $extensionRoot. Run 'npm run package:vsix' first."
}

$codeCli = Resolve-CodeCliPath
Write-Host "Installing VSIX via: $codeCli"
Write-Host "VSIX: $($latestVsix.FullName)"

$process = Start-Process -FilePath $codeCli -ArgumentList @("--install-extension", $latestVsix.FullName, "--force") -Wait -PassThru -NoNewWindow
if ($process.ExitCode -ne 0) {
  throw "VSIX install failed with exit code $($process.ExitCode)."
}

Write-Host "Installed/updated Xupra DryLake extension successfully."
Write-Host "Next step: Reload VS Code window."
