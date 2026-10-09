$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile-native'
$android = Join-Path $mobile 'android'
$appDir = Join-Path $android 'app'
$wwwDir = Join-Path $mobile 'www'
$assetsBuilder = Join-Path $PSScriptRoot 'build-apk-www.ps1'
$releaseApk = Join-Path $appDir 'build\outputs\apk\release\app-release.apk'

$sourceConfig = Get-Content (Join-Path $root 'maneko-app\js\config.js') -Raw
if ($sourceConfig -notmatch 'apiBase:\s*[''"]{2}' -or
    $sourceConfig -notmatch 'allowDemo:\s*false' -or
    $sourceConfig -notmatch 'lockApiBase:\s*false') {
  throw 'Self-hosted release requires an empty, editable API setting with demo mode disabled in maneko-app/js/config.js.'
}

$propertiesFile = Join-Path $appDir 'keystore.properties'
$requiredSigningEnv = @(
  'MANEKO_KEYSTORE_PATH',
  'MANEKO_KEYSTORE_PASSWORD',
  'MANEKO_KEY_ALIAS',
  'MANEKO_KEY_PASSWORD'
)
$providedSigningEnv = @($requiredSigningEnv | Where-Object { [Environment]::GetEnvironmentVariable($_) })
if (-not (Test-Path $propertiesFile -PathType Leaf) -and $providedSigningEnv.Count -ne $requiredSigningEnv.Count) {
  throw 'Release blocked: provide a complete private signing configuration in app/keystore.properties or all four MANEKO_KEYSTORE_* environment values.'
}
if (Test-Path -LiteralPath $releaseApk) {
  throw "Release blocked: existing output would be overwritten. Move or archive it first: $releaseApk"
}

$wwwBackup = $null
if (Test-Path -LiteralPath $wwwDir) {
  $wwwBackup = Join-Path $mobile ('.www-before-release-' + [guid]::NewGuid().ToString('N'))
  Move-Item -LiteralPath $wwwDir -Destination $wwwBackup
}

try {
  & powershell -ExecutionPolicy Bypass -File $assetsBuilder
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare self-hosted app assets.' }

  $generatedConfig = Get-Content (Join-Path $wwwDir 'js\config.js') -Raw
  if ($generatedConfig -notmatch 'apiBase:\s*[''"]{2}' -or
      $generatedConfig -notmatch 'allowDemo:\s*false' -or
      $generatedConfig -notmatch 'lockApiBase:\s*false') {
    throw 'Generated assets are not a self-hosted, live-mode build.'
  }

  if (-not (Test-Path (Join-Path $mobile 'node_modules'))) {
    Push-Location $mobile
    try {
      npm install --no-package-lock
      if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    } finally { Pop-Location }
  }

  Push-Location $mobile
  try {
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
  } finally { Pop-Location }

  Push-Location $android
  try {
    & .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleRelease failed.' }
  } finally { Pop-Location }

  if (-not (Test-Path -LiteralPath $releaseApk -PathType Leaf)) {
    throw 'Build ended without the expected signed release APK.'
  }

  $sdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'D:\Android\Sdk' }
  $buildTools = Join-Path $sdkRoot 'build-tools\36.0.0'
  $apksigner = Join-Path $buildTools 'apksigner.bat'
  $aapt = Join-Path $buildTools 'aapt.exe'
  if (-not (Test-Path $apksigner) -or -not (Test-Path $aapt)) {
    throw "Android API 36 Build Tools are required under $buildTools."
  }

  & $apksigner verify --verbose --print-certs $releaseApk
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }

  $badging = (& $aapt dump badging $releaseApk 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0 -or
      $badging -notmatch "package: name='com\.maneko\.app' versionCode='2' versionName='1\.0\.2'" -or
      $badging -notmatch "targetSdkVersion:'36'") {
    throw 'APK package id, version, or target SDK does not match the v1.0.2 release contract.'
  }

  $sha256 = (Get-FileHash -LiteralPath $releaseApk -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host "Signed self-hosted APK: $releaseApk" -ForegroundColor Green
  Write-Host "SHA-256: $sha256"
} finally {
  if (Test-Path -LiteralPath $wwwDir) {
    Remove-Item -LiteralPath $wwwDir -Recurse -Force
  }
  if ($wwwBackup -and (Test-Path -LiteralPath $wwwBackup)) {
    Move-Item -LiteralPath $wwwBackup -Destination $wwwDir
  }
}
