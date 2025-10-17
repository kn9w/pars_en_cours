# Build and Release Flow

This document describes the current build and release workflows for the Pars en Cours React Native application.

## Overview

The project uses two GitHub Actions workflows:
- **Build Workflow** (`build.yml`) - Creates preview APKs for development/testing
- **Release Workflow** (`build-and-release.yml`) - Creates official releases with GitHub Releases

## 📦 Build Workflow (Preview Builds)

### Purpose
Automatically builds preview APKs for testing during development. These are not intended for production distribution.

### Triggers
- Push to branches: `main`, `dev`, `new-features`
- Pull requests to: `main`, `dev`
- Manual trigger via GitHub Actions UI (workflow_dispatch)

### Build Steps

1. **Repository Setup**
   - Checks out the repository code

2. **Environment Setup**
   - Node.js 20 with npm caching
   - JDK 17 (Temurin distribution)
   - Android SDK
   - Expo CLI (latest)
   - EAS CLI (latest)

3. **Dependency Installation**
   - Runs `npm ci` for clean install

4. **Environment Configuration**
   - Creates `.env` file with required secrets:
     - `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN`
     - `MAPBOX_DOWNLOAD_TOKEN`
     - `EXPO_PUBLIC_EAS_PROJECT_ID`
     - `EXPO_PUBLIC_ENABLE_MAPBOX=true`

5. **Version Extraction**
   - Reads version from `app.json` (expo.version field)
   - Stores in `$GITHUB_OUTPUT` for later steps

6. **APK Build**
   - Command: `eas build --platform android --profile production --local`
   - Output filename: `pars-en-cours-v{version}-preview.apk`
   - Build type: Local build on GitHub runner

7. **Artifact Upload**
   - Uploads APK to GitHub Actions artifacts
   - Artifact name: `pars-en-cours-v{version}-preview-{commit-sha}`
   - Retention: 30 days
   - Accessible via GitHub Actions UI

### Output
- Preview APK available as downloadable artifact
- Not publicly accessible (requires GitHub login)
- Automatically cleaned up after 30 days

### EAS Profile Used
- Profile: `production`
- Configuration from `eas.json`:
  ```json
  "production": {
    "autoIncrement": false,
    "android": {
      "buildType": "apk"
    }
  }
  ```

---

## 🚀 Release Workflow (Official Releases)

### Purpose
Creates official production releases with public GitHub Releases and downloadable APK files.

### Triggers
- Push of git tags starting with `v` (e.g., `v0.0.1`, `v1.2.3`)
- Manual trigger via GitHub Actions UI (workflow_dispatch)

### Build Steps

Steps 1-8 are identical to the Build Workflow.

9. **APK Build**
   - Command: `eas build --platform android --profile production --local`
   - Output filename: `pars-en-cours-v{version}.apk` (no "-preview" suffix)

10. **Checksum Generation**
    - SHA256 checksum: `pars-en-cours-v{version}.apk.sha256`
    - MD5 checksum: `pars-en-cours-v{version}.apk.md5`
    - Used for integrity verification

11. **Build Information**
    - Creates `build-info.json` with metadata:
      - Version number
      - Git tag
      - Commit SHA
      - Build date (UTC)
      - Build environment
      - Node.js, npm, and Expo versions

12. **GitHub Release Creation**
    - Creates public GitHub Release
    - Attaches files:
      - APK file
      - SHA256 checksum
      - MD5 checksum
      - Build info JSON
    - Auto-generates release notes with:
      - Download instructions
      - Verification instructions
      - Build information
      - Link to CHANGELOG.md

### Output
- Public GitHub Release page
- Downloadable APK (no GitHub login required)
- Checksum files for verification
- Permanent storage (no automatic cleanup)

### EAS Profile Used
Same as Build Workflow (`production` profile)

---

## 🔧 Version Management

### Current Version
Defined in two files (must be kept in sync):
- `app.json` - `expo.version` field
- `package.json` - `version` field

Current version: `0.0.1`

### Version Script

Location: `scripts/version.js`

Available commands:
```bash
# Show current version
npm run version

# Bump patch version (0.0.1 → 0.0.2)
npm run version:patch

# Bump minor version (0.0.1 → 0.1.0)
npm run version:minor

# Bump major version (0.0.1 → 1.0.0)
npm run version:major
```

### What the version script does:
1. Updates version in `app.json`
2. Updates version in `package.json`
3. Creates a local git tag (e.g., `v0.0.2`)
4. Prints instructions to push the tag

### What it does NOT do:
- Does not commit the version changes
- Does not push the tag automatically
- Requires manual git operations

---

## 📝 Manual Release Process

To create a new release, follow these steps:

### Step 1: Bump Version
```bash
npm run version:patch  # or :minor or :major
```

Output:
```
✅ Updated version to 0.0.2 in app.json and package.json
✅ Created git tag: v0.0.2

🚀 To push the tag and trigger the build:
   git push origin v0.0.2
```

### Step 2: Commit Version Changes
```bash
git add app.json package.json
git commit -m "chore: bump version to 0.0.2"
```

### Step 3: Push Changes
```bash
git push origin main
```

### Step 4: Move Tag to Updated Commit
```bash
# Delete local tag
git tag -d v0.0.2

# Recreate tag on new commit
git tag -a v0.0.2 -m "Release v0.0.2"
```

### Step 5: Push Tag
```bash
git push origin v0.0.2
```

### Step 6: Monitor Build
- Go to GitHub Actions page
- Watch the "Release APK" workflow
- Wait for completion (typically 15-20 minutes)

### Step 7: Verify Release
- Check GitHub Releases page
- Download and verify APK using checksums

---

## 🔐 Required GitHub Secrets

The following secrets must be configured in GitHub repository settings:

| Secret Name | Purpose | Used In |
|------------|---------|---------|
| `EXPO_TOKEN` | Authenticates with Expo services | Both workflows |
| `MAPBOX_PUBLIC_TOKEN` | Mapbox map display | Both workflows |
| `MAPBOX_DOWNLOAD_TOKEN` | Mapbox SDK download | Both workflows |
| `EAS_PROJECT_ID` | EAS project identifier | Both workflows |
| `GITHUB_TOKEN` | Create releases (auto-provided) | Release workflow |

---

## 🏗️ EAS Build Configuration

Location: `eas.json`

### Available Profiles

#### Development
```json
{
  "developmentClient": true,
  "distribution": "internal"
}
```
- For development builds with dev client
- Not currently used in CI

#### Preview
```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```
- Intended for preview builds
- Not currently used in CI (workflows use `production` instead)

#### Production
```json
{
  "autoIncrement": false,
  "android": {
    "buildType": "apk"
  }
}
```
- Used for both preview and release builds
- Generates APK (not AAB)
- No automatic version incrementing

---

## 📊 Build Timeline

Typical build duration: **15-20 minutes**

Breakdown:
- Setup (Node, Java, Android SDK): ~3-5 minutes
- Dependency installation: ~2-3 minutes
- EAS build: ~10-15 minutes
- Upload/Release: ~1 minute

---

## 🔍 Verification

### For Preview Builds
1. Go to GitHub Actions
2. Click on the workflow run
3. Download artifact from "Artifacts" section
4. Install on Android device for testing

### For Releases
1. Download APK and checksum from GitHub Releases
2. Verify integrity:
   ```bash
   sha256sum -c pars-en-cours-v0.0.1.apk.sha256
   ```
3. Install on Android device

---

## ⚠️ Known Limitations

1. **Same Profile for Preview and Release**
   - Both workflows use `production` profile
   - No distinction between preview and production builds
   - Preview profile exists in `eas.json` but is unused

2. **Manual Version Process**
   - Version bumps require multiple manual git commands
   - Easy to forget to commit changes before tagging
   - Tag may point to wrong commit

3. **No Automated Testing**
   - No linting, type checking, or unit tests before builds
   - Broken code can result in failed builds late in the process

4. **No Build Caching**
   - Gradle and dependency downloads happen every build
   - Increases build time

5. **Local Builds Only**
   - Using `--local` flag on GitHub runners
   - Not leveraging EAS cloud build infrastructure

6. **No Changelog Automation**
   - Release notes reference CHANGELOG.md but don't include it
   - Changelog must be manually maintained

7. **No Duplicate Release Prevention**
   - Workflow will attempt to create release even if version already exists
   - Will fail if tag already exists

---

## 📁 Related Files

- `.github/workflows/build.yml` - Preview build workflow
- `.github/workflows/build-and-release.yml` - Release workflow
- `eas.json` - EAS build configuration
- `app.json` - Expo configuration and version
- `package.json` - npm configuration and version
- `scripts/version.js` - Version management script

---

## 📚 Additional Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup guide
- [RELAY_ARCHITECTURE.md](./RELAY_ARCHITECTURE.md) - Nostr relay architecture
- [PROFILE_CACHE_SYSTEM.md](./PROFILE_CACHE_SYSTEM.md) - Profile caching
- [PROFILE_PREFETCH_FEATURE.md](./PROFILE_PREFETCH_FEATURE.md) - Profile prefetching

---