# Self-hosted Android Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Maneko v1.0.2 as a signed, directly installable, full-function self-hosted Android APK on GitHub.

**Architecture:** Build the existing Capacitor app from `maneko-app/` with its blank, user-configurable API origin and demo mode disabled. Keep the existing hosted-release path separate, produce a signed APK targeting API 36, then attach only the verified APK and checksum to a new GitHub Release.

**Tech Stack:** Capacitor 6, Gradle 8.13, Android Gradle Plugin 8.13.2, Android SDK 36, PowerShell, Node test runner, GitHub Releases.

---

### Task 1: Protect local state and settle signing

**Files:**
- Read only: `mobile-native/android/app/build.gradle`
- Read only: `mobile-native/android/app/keystore.properties.example`
- Read only: `mobile-native/android/app/keystore.properties` (if present)
- Read only: `mobile-native/www/` (if present)

- [ ] Check `git status --short`; keep the user's CORS edits, launcher icons, and untracked assets outside all release commits.
- [ ] Check whether `mobile-native/www/` exists and preserve it before any script that rebuilds this directory.
- [ ] Ask the owner to select an existing private keystore, authorize creation of a new long-term keystore (which requires uninstalling the old debug-signed app), or explicitly accept the insecure debug signer. Do not print or commit passwords.
- [ ] Do not publish until the selected signing input is available and `apksigner verify` succeeds.

### Task 2: Prepare API 36 and add a self-hosted release contract

**Files:**
- Modify: `mobile-native/android/app/build.gradle`
- Modify: `mobile-native/package.json`
- Create: `scripts/build-android-selfhosted-release.ps1`
- Create: `scripts/tests/selfhosted-release-contract.test.cjs`
- Modify: `docs/RELEASE.md`

- [ ] Install `platforms;android-36` and `build-tools;36.0.0` using `D:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`.
- [ ] Write a Node test that asserts the app defaults to `apiBase: ''`, `allowDemo: false`, `lockApiBase: false`; that Android version metadata is `2` / `1.0.2`; and that the self-hosted build command does not require `MANEKO_API_BASE` or `/ready`.
- [ ] Run `node --test scripts/tests/selfhosted-release-contract.test.cjs` and confirm it fails because the new release task/metadata are absent.
- [ ] Change Android `versionCode` from `1` to `2` and `versionName` from `1.0.0` to `1.0.2`.
- [ ] Add a dedicated PowerShell self-hosted release script that calls `build-apk-www.ps1` without `-ApiBase`, verifies demo remains disabled and API remains unlocked, syncs Capacitor, then invokes `gradlew.bat assembleRelease` and checks the expected APK exists.
- [ ] Add `apk:release:self-hosted` to `mobile-native/package.json` and document HTTPS API setup, release signing, artifact path, and the no-shared-backend model in `docs/RELEASE.md`.
- [ ] Run the contract test and mobile application tests; require all to pass.

### Task 3: Build and inspect the installable APK

**Files:**
- Build output: `mobile-native/android/app/build/outputs/apk/release/app-release.apk`

- [ ] Preserve any existing `mobile-native/www/` before building; restore its prior contents afterward if this task overwrote it.
- [ ] Run `npm run apk:release:self-hosted` from `mobile-native/` with the owner-selected signing environment.
- [ ] Verify the APK signature with `D:\Android\Sdk\build-tools\36.0.0\apksigner.bat verify --verbose --print-certs <APK>`.
- [ ] Verify package id `com.maneko.app`, version code `2`, version name `1.0.2`, and target SDK `36` with `aapt dump badging`.
- [ ] Compute the final artifact SHA-256 and retain the exact locally built APK for upload.

### Task 4: Publish v1.0.2 on GitHub

**Files:**
- Release asset: `Maneko-v1.0.2-selfhosted.apk`
- Release notes: self-hosted setup instructions and APK SHA-256

- [ ] Confirm the source commit and `v1.0.2` tag are pushed to `origin` without including the user's unrelated local changes.
- [ ] Confirm release-write authentication is available; if not, stop before any partial release and request the required GitHub authorization.
- [ ] Create a new GitHub Release tagged `v1.0.2`; do not overwrite or delete `v1.0.1`.
- [ ] Upload the verified APK and publish notes that clearly say users must configure their own HTTPS backend.
- [ ] Download or otherwise hash-check the published asset; require its SHA-256 to equal the local artifact before reporting completion.
