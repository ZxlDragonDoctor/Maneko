# 将 maneko-app 生产应用同步为 Capacitor www/
# Generate Capacitor web assets from the full mobile app.
param([string]$ApiBase)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'maneko-app'
$dst = Join-Path $root 'mobile-native\www'

if (-not (Test-Path $src)) { throw "maneko-app not found: $src" }
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Copy-Item (Join-Path $src '*') $dst -Recurse -Force

if ($ApiBase) {
  $uri = $null
  if (-not [Uri]::TryCreate($ApiBase, [UriKind]::Absolute, [ref]$uri)) {
    throw 'ApiBase must be an absolute HTTPS URL.'
  }
  if ($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.AbsolutePath -notin @('', '/') -or $uri.Host -match '^(localhost|127\.0\.0\.1|0\.0\.0\.0)$|\.example$|\.local$') {
    throw 'Release API must be a public HTTPS origin (no credentials, path, localhost or placeholder domain).'
  }
  $apiLiteral = ConvertTo-Json -InputObject $uri.GetLeftPart([UriPartial]::Authority) -Compress
  $config = @"
/* Generated for this build. Do not edit secrets into this file. */
window.MANEKO_CONFIG = {
  apiBase: $apiLiteral,
  allowDemo: false,
  lockApiBase: true,
};
"@
  Set-Content -Path (Join-Path $dst 'js\config.js') -Value $config -Encoding utf8
}

Write-Host "www prepared from maneko-app -> $dst"
Get-ChildItem $dst -Recurse -File | Select-Object -First 15 Name, Length
