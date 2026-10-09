# Self-hosted Android Release Design

## Objective

Publish a new GitHub release for Maneko as a directly installable Android APK. The app keeps its complete reader, library, novel parsing, comic scripting, image generation, and export flows; it is not a demo build and does not depend on a shared hosted API.

## Product and runtime behavior

- Build from `maneko-app/` through the existing Capacitor Android project.
- Ship with an empty API origin, `allowDemo: false`, and an unlocked API setting so the installer can configure their own HTTPS Maneko backend.
- Do not package model credentials, a production host, or sample/mock content as if it were generated output.
- Document that the user operates the backend and supplies valid AI/image-provider credentials; this release does not create a public multi-tenant service.

## Release artifact

- Create a signed release APK for direct GitHub download, with `versionName` `1.0.2` and `versionCode` `2`.
- Target Android API 36 and verify package id, version, signature, and SHA-256 before upload.
- Publish a new `v1.0.2` GitHub Release and leave `v1.0.1` unchanged.
- Preserve update compatibility only with a signer selected by the owner. The existing `v1.0.1` APK is signed by the standard Android debug certificate; matching that certificate preserves upgrades but is not a secure long-term release key. A new private key is safer but requires uninstalling the old app before installing `v1.0.2`.

## Release gates

- Install Android API 36 platform/build tools and successfully build the release artifact.
- Obtain explicit owner choice for the signing key. Do not create, replace, commit, or publish private signing material without that choice.
- Confirm GitHub release-write authentication before attempting the external release operation.
- If signing or upload authentication is unavailable, preserve the built artifact and report the precise blocker rather than publishing an unsigned/debug artifact as a production release.

## Verification

- Run the mobile app tests and release-script contract tests.
- Build the APK, verify its signature with `apksigner`, and inspect package/version/target SDK using Android build tools.
- Calculate SHA-256 and confirm the uploaded release asset matches the locally verified artifact.
