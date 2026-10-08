# Maneko Android APK
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile-native'

Set-Location $mobile

Write-Host '==> prepare www'
& powershell -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\build-apk-www.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare mobile app assets.' }

if (-not (Test-Path (Join-Path $mobile 'node_modules'))) {
  Write-Host '==> npm install'
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
}

Write-Host '==> cap sync android'
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }

$gradlew = Join-Path $mobile 'android\gradlew.bat'
if (-not (Test-Path $gradlew)) {
  Write-Host 'Android project missing. Run: npx cap add android' -ForegroundColor Yellow
  exit 1
}

Write-Host '==> assembleDebug APK'
Set-Location (Join-Path $mobile 'android')
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleDebug failed.' }

$apk = Join-Path $mobile 'android\app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  Write-Host "APK ready: $apk" -ForegroundColor Green
} else {
  Write-Host 'APK not found — check Android SDK / JAVA_HOME' -ForegroundColor Red
  exit 1
}
