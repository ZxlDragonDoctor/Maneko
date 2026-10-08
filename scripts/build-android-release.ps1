param([string]$ApiBase = $env:MANEKO_API_BASE)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile-native'
$android = Join-Path $mobile 'android'
$appDir = Join-Path $android 'app'

if (-not $ApiBase) { throw 'Release blocked: set MANEKO_API_BASE to the production API origin.' }
$uri = $null
if (-not [Uri]::TryCreate($ApiBase, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https') {
  throw 'Release blocked: MANEKO_API_BASE must be an absolute HTTPS URL.'
}
if ($uri.UserInfo -or $uri.AbsolutePath -notin @('', '/') -or $uri.Host -match '^(localhost|127\.0\.0\.1|0\.0\.0\.0)$|\.example$|\.local$') {
  throw 'Release blocked: use a public HTTPS API origin without credentials, path, or placeholder host.'
}

try {
  $readiness = Invoke-RestMethod -Uri ($uri.GetLeftPart([UriPartial]::Authority) + '/ready') -TimeoutSec 90
} catch {
  throw "Release blocked: production API /ready did not succeed. Verify database, AI credentials, image provider and storage before building. $($_.Exception.Message)"
}
if ($readiness.status -ne 'ready') { throw 'Release blocked: production API is not ready for real chapter and image generation.' }

$propertiesFile = Join-Path $appDir 'keystore.properties'
$signing = @{}
if (Test-Path $propertiesFile) {
  Get-Content $propertiesFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)$') { $signing[$matches[1].Trim()] = $matches[2].Trim() }
  }
}
$storePath = if ($env:MANEKO_KEYSTORE_PATH) { $env:MANEKO_KEYSTORE_PATH } else { $signing['storeFile'] }
$storePassword = if ($env:MANEKO_KEYSTORE_PASSWORD) { $env:MANEKO_KEYSTORE_PASSWORD } else { $signing['storePassword'] }
$keyAlias = if ($env:MANEKO_KEY_ALIAS) { $env:MANEKO_KEY_ALIAS } else { $signing['keyAlias'] }
$keyPassword = if ($env:MANEKO_KEY_PASSWORD) { $env:MANEKO_KEY_PASSWORD } else { $signing['keyPassword'] }
if (-not $storePath -or -not $storePassword -or -not $keyAlias -or -not $keyPassword -or
    "$storePath $storePassword $keyAlias $keyPassword" -match 'replace-with|your-password|placeholder') {
  throw 'Release blocked: configure all four signing values in ignored app/keystore.properties or MANEKO_* environment variables.'
}
$resolvedStorePath = if ([IO.Path]::IsPathRooted($storePath)) { $storePath } else { Join-Path $appDir $storePath }
if (-not (Test-Path $resolvedStorePath -PathType Leaf)) { throw "Release blocked: signing keystore does not exist: $resolvedStorePath" }

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-apk-www.ps1') -ApiBase ($uri.GetLeftPart([UriPartial]::Authority))
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare production app assets.' }
if (-not (Test-Path (Join-Path $mobile 'node_modules'))) {
  Push-Location $mobile
  try { npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } }
  finally { Pop-Location }
}

Push-Location $mobile
try { npx cap sync android; if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' } }
finally { Pop-Location }

Push-Location $android
try {
  & .\gradlew.bat bundleRelease
  if ($LASTEXITCODE -ne 0) { throw 'Gradle bundleRelease failed.' }
} finally { Pop-Location }

$aab = Join-Path $appDir 'build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aab)) { throw 'Build ended without the expected signed AAB.' }
Write-Host "Signed release AAB ready: $aab" -ForegroundColor Green
