$ErrorActionPreference = "Stop"

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

$extensionId = "xupra.drylake"
$codeCli = Resolve-CodeCliPath

Write-Host "Uninstalling extension: $extensionId"
Write-Host "Using CLI: $codeCli"

$process = Start-Process -FilePath $codeCli -ArgumentList @("--uninstall-extension", $extensionId) -Wait -PassThru -NoNewWindow
if ($process.ExitCode -ne 0) {
  throw "Uninstall command failed with exit code $($process.ExitCode)."
}

Write-Host "Uninstall command completed."
Write-Host "If VS Code is open, run 'Developer: Reload Window'."
