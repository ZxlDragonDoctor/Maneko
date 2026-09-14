# 将生产 API 写入 maneko-app/js/core.js 并同步到 Capacitor www
param(
  [Parameter(Mandatory = $true)][string]$ApiBase
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$core = Join-Path $root 'maneko-app\js\core.js'
if (-not (Test-Path $core)) { throw "core.js not found: $core" }

$js = Get-Content $core -Raw
if ($js -match "const PROD_API = '[^']*';") {
  $js = $js -replace "const PROD_API = '[^']*';", "const PROD_API = '$ApiBase';"
} elseif ($js -match 'const PROD_API = "";') {
  $js = $js -replace 'const PROD_API = "";', "const PROD_API = '$ApiBase';"
} else {
  throw "PROD_API declaration not found in core.js"
}
Set-Content -Path $core -Value $js -Encoding UTF8
Write-Host "core.js PROD_API = $ApiBase"

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-apk-www.ps1')
Write-Host "Done. Next: npx cap sync android && gradlew assembleDebug"
