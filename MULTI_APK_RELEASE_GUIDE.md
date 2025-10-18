# Multi-APK Release Guide

## Summary of Changes

Your GitHub workflow has been updated to build and release **architecture-specific APKs** instead of a single universal APK.

## What Changed

### 1. Expo Config Plugin (`plugins/withAndroidABISplits.js`)
- ✅ Created custom Expo config plugin to add APK splits
- ✅ Automatically adds APK splits configuration during build
- ✅ Adds version code management for each architecture
- ✅ Configured to build 5 APKs:
  - 4 architecture-specific APKs (arm64-v8a, armeabi-v7a, x86_64, x86)
  - 1 universal APK (works on all devices)
- ⚠️ **Important:** This plugin modifies `build.gradle` during the build process

### 2. App Configuration (`app.config.ts`)
- ✅ Added the APK splits plugin to the plugins array
- ✅ Plugin will be applied during EAS build (prebuild step)

### 3. EAS Configuration (`eas.json`)
- ✅ Kept existing `production` profile (builds APKs)
- ✅ Added new `production-aab` profile (for Google Play Store AAB format)

### 4. GitHub Workflow (`.github/workflows/build-and-release.yml`)
- ✅ Updated build step to build all architectures
- ✅ Added step to find and organize all generated APKs
- ✅ Updated checksums to generate for each APK
- ✅ Added download instructions to release notes
- ✅ Updated release creation to upload all APKs

### 5. Documentation
- ✅ Created `docs/ARCHITECTURE_SPECIFIC_BUILDS.md` - Detailed architecture guide
- ✅ Updated `docs/BUILD_AND_RELEASE_FLOW.md` - Updated workflow documentation

## Important: Expo Project Considerations

This is an **Expo project**, which means:

- ⚠️ The `android/` folder is **gitignored** and auto-generated during builds
- ✅ You **cannot** directly edit `android/app/build.gradle` permanently
- ✅ Instead, use the **Expo config plugin** (`plugins/withAndroidABISplits.js`)
- ✅ The plugin modifies `build.gradle` automatically during the **prebuild** step
- ✅ This happens automatically in EAS builds and GitHub Actions

## What Your Next Release Will Look Like

When you push a new tag (e.g., `v0.0.2`), the workflow will:

1. **Build 5 APKs:**
   - `pars-en-cours-v0.0.2-arm64-v8a.apk` (~40-50 MB) ⭐ Most users
   - `pars-en-cours-v0.0.2-armeabi-v7a.apk` (~35-45 MB)
   - `pars-en-cours-v0.0.2-x86_64.apk` (~45-55 MB)
   - `pars-en-cours-v0.0.2-x86.apk` (~40-50 MB)
   - `pars-en-cours-v0.0.2-universal.apk` (~80-100 MB) 🔧 Compatibility fallback

2. **Generate checksums for each:**
   - 5 `.sha256` files
   - 5 `.md5` files

3. **Create GitHub Release with:**
   - 15 total files (5 APKs + 10 checksum files)
   - Enhanced release notes with download instructions
   - Clear guidance on which APK users should download

## Example Release Notes

Your GitHub release will automatically include:

```markdown
## Added
- Initial release features...

---

## 📥 Download Instructions

This release includes **architecture-specific APKs** for smaller download sizes.

### Which APK should I download?

**For most users (recommended):**
- 📱 **`pars-en-cours-v0.0.2-arm64-v8a.apk`** - Modern Android devices (64-bit ARM)
  - Most Android phones from 2017+

**If the above doesn't work:**
- 📱 **`pars-en-cours-v0.0.2-armeabi-v7a.apk`** - Older Android devices (32-bit ARM)
  - Older Android phones

**For special devices (rare):**
- 💻 **`pars-en-cours-v0.0.2-x86_64.apk`** - Intel/AMD Android devices (64-bit)
- 💻 **`pars-en-cours-v0.0.2-x86.apk`** - Intel/AMD Android devices (32-bit)

### ✅ Verification

Each APK includes checksum files (`.sha256` and `.md5`) for integrity verification...
```

## Testing Locally

To test that the APK splits work correctly before pushing a release:

### Option 1: Using EAS Build Locally
```bash
eas build --platform android --profile production --local
```

This runs the full build process including the config plugin.

### Option 2: Using Gradle Directly
```bash
# First, run prebuild to generate the android folder with the plugin applied
npx expo prebuild --platform android

# Then build with Gradle
cd android
./gradlew assembleRelease
```

Then check the output:
```bash
ls -lh app/build/outputs/apk/release/
```

You should see 5 APK files:
- `app-arm64-v8a-release.apk`
- `app-armeabi-v7a-release.apk`
- `app-x86_64-release.apk`
- `app-x86-release.apk`
- `app-universal-release.apk`

**Note:** After testing, you may want to run `npx expo prebuild --clean` to reset the android folder.

## Size Comparison

Before (universal APK):
- **~80-100 MB** - Contains all architectures

After (architecture-specific APKs):
- **~35-55 MB each** - Users download only what they need
- **~40-60% smaller** per download

## Next Release Process

The process remains the same as before:

```bash
# 1. Bump version
npm run version:patch

# 2. Commit changes
git add app.json package.json
git commit -m "chore: bump version to 0.0.2"

# 3. Push changes
git push origin main

# 4. Recreate tag on new commit
git tag -d v0.0.2
git tag -a v0.0.2 -m "Release v0.0.2"

# 5. Push tag to trigger workflow
git push origin v0.0.2
```

The workflow will automatically:
- Build all 4 architecture-specific APKs
- Generate checksums for each
- Create a GitHub Release with all files
- Add download instructions to the release notes

## Additional Options

### Option 1: Remove Universal APK (Only Architecture-Specific)

If you want to **only** provide architecture-specific APKs and skip the universal APK, edit `plugins/withAndroidABISplits.js`:

```javascript
// Find this line:
universalApk true

// Change it to:
universalApk false
```

This will create 4 APKs instead of 5 (saves build time and storage).

### Option 2: Build for Google Play Store (AAB)

For Google Play Store distribution, use the AAB format:

```bash
eas build --platform android --profile production-aab
```

Google Play will automatically split and serve the correct APK to each user.

## Questions?

- **Why 5 APKs?** - 4 smaller architecture-specific ones + 1 universal for compatibility
- **Which should most users download?** - arm64-v8a (covers ~85% of modern devices)
- **When should users use the universal APK?** - If the architecture-specific one doesn't work, or if they're unsure
- **What if users download the wrong one?** - Android will refuse to install it, they can try another or use the universal APK
- **Can I remove the universal APK?** - Yes, set `universalApk false` in the config plugin

## Documentation

For more details, see:
- [`docs/ARCHITECTURE_SPECIFIC_BUILDS.md`](docs/ARCHITECTURE_SPECIFIC_BUILDS.md) - Complete technical guide
- [`docs/BUILD_AND_RELEASE_FLOW.md`](docs/BUILD_AND_RELEASE_FLOW.md) - Updated workflow documentation

---

**Ready to release?** Just push a new tag and watch the magic happen! 🚀

