const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('self-hosted app defaults to configurable live API without demo data', () => {
  const config = read('maneko-app/js/config.js')

  assert.match(config, /apiBase:\s*['"]{2}/)
  assert.match(config, /allowDemo:\s*false/)
  assert.match(config, /lockApiBase:\s*false/)
})

test('Android release version advances beyond the published v1.0.1', () => {
  const gradle = read('mobile-native/android/app/build.gradle')

  assert.match(gradle, /versionCode\s+2\b/)
  assert.match(gradle, /versionName\s+['"]1\.0\.2['"]?/)
})

test('self-hosted release command builds an installable APK without a hosted API', () => {
  const packageJson = JSON.parse(read('mobile-native/package.json'))
  const scriptPath = 'scripts/build-android-selfhosted-release.ps1'

  assert.equal(
    packageJson.scripts['apk:release:self-hosted'],
    'powershell -ExecutionPolicy Bypass -File ../scripts/build-android-selfhosted-release.ps1',
  )
  assert.ok(fs.existsSync(path.join(root, scriptPath)))

  const script = read(scriptPath)
  assert.match(script, /build-apk-www\.ps1/)
  assert.match(script, /assembleRelease/)
  assert.match(script, /app-release\.apk/)
  assert.doesNotMatch(script, /MANEKO_API_BASE|\/ready/)
})
