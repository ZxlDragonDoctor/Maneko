# 将 maneko-app 生产应用同步为 Capacitor www/
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'maneko-app'
$dst = Join-Path $root 'mobile-native\www'

if (-not (Test-Path $src)) { throw "maneko-app not found: $src" }
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Copy-Item (Join-Path $src '*') $dst -Recurse -Force
Write-Host "www prepared from maneko-app -> $dst"
Get-ChildItem $dst -Recurse -File | Select-Object -First 15 Name, Length
