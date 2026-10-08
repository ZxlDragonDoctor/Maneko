# 将 API 写入本次生成的 Capacitor www，不改源文件或提交环境配置。
param(
  [Parameter(Mandatory = $true)][string]$ApiBase
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-apk-www.ps1') -ApiBase $ApiBase
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare release app assets.' }
Write-Host "Done. For a signed store bundle, use npm run apk:release after configuring the release signing key."
