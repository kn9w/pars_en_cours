# Architecture-Specific APK Builds

This document explains how to build and distribute architecture-specific APKs for Android.

## Overview

Instead of creating one large APK that contains native libraries for all CPU architectures, you can create separate APKs for each architecture. This results in:

- **Smaller download sizes** (~40-60% smaller per APK)
- **Faster installation** 
- **Better user experience** (users only download what they need)

## Supported Architectures

The app is configured to build for these architectures:

| Architecture | Devices | Version Code Suffix |
|-------------|---------|-------------------|
| `arm64-v8a` | Modern Android devices (64-bit ARM) | +2 |
| `armeabi-v7a` | Older Android devices (32-bit ARM) | +1 |
| `x86_64` | Intel/AMD Android devices (64-bit x86) | +4 |
| `x86` | Intel/AMD Android devices (32-bit x86) | +3 |

**Note**: ~95% of Android devices use ARM architecture (arm64-v8a or armeabi-v7a).

## Configuration

### 1. Gradle Configuration (android/app/build.gradle)

The APK splits are configured in the `splits` block:

```gradle
splits {
    abi {
        enable true
        reset()
        include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        universalApk false  // Set to true if you also want a universal APK
    }
}
```

### 2. Version Code Management

Each architecture gets a unique version code to allow Google Play to serve the correct APK:

- Base version code: `1`
- arm64-v8a: `12` (1 × 10 + 2)
- armeabi-v7a: `11` (1 × 10 + 1)
- x86_64: `14` (1 × 10 + 4)
- x86: `13` (1 × 10 + 3)

This ensures arm64-v8a (the most modern architecture) has the highest priority.

### 3. EAS Build Profiles

Two production profiles are available in `eas.json`:

#### Option A: APK Splits (Current Default)
```json
"production": {
  "autoIncrement": false,
  "android": {
    "buildType": "apk",
    "credentialsSource": "local"
  }
}
```

**Output**: 4 separate APKs (one per architecture)

#### Option B: Android App Bundle (AAB)
```json
"production-aab": {
  "autoIncrement": false,
  "android": {
    "buildType": "app-bundle",
    "credentialsSource": "local"
  }
}
```

**Output**: 1 AAB file that Google Play automatically splits

## Building

### Local Build

Build all architecture-specific APKs:

```bash
eas build --platform android --profile production --local
```

This will create 4 APK files in the output directory:
- `app-armeabi-v7a-release.apk`
- `app-arm64-v8a-release.apk`
- `app-x86-release.apk`
- `app-x86_64-release.apk`

### Cloud Build

```bash
eas build --platform android --profile production
```

EAS will build all variants and provide download links for each.

### Build for Google Play (AAB)

```bash
eas build --platform android --profile production-aab
```

## Distribution

### Option 1: Direct APK Distribution (GitHub Releases, etc.)

**Recommended approach**: Provide all 4 APKs and let users choose, or provide clear guidance:

**For most users (recommended)**:
- Download `app-arm64-v8a-release.apk` (modern 64-bit ARM devices)

**If that doesn't work**:
- Try `app-armeabi-v7a-release.apk` (older 32-bit ARM devices)

**For special devices** (rare):
- Intel/AMD tablets: `app-x86_64-release.apk` or `app-x86-release.apk`

### Option 2: Google Play Store

For Google Play distribution, use the AAB format:

```bash
eas build --platform android --profile production-aab
eas submit --platform android
```

Google Play automatically serves the correct APK variant to each user based on their device.

## File Sizes

Approximate sizes (will vary based on your app):

| Build Type | Size |
|-----------|------|
| Universal APK (all architectures) | ~80-100 MB |
| arm64-v8a APK | ~40-50 MB |
| armeabi-v7a APK | ~35-45 MB |
| x86_64 APK | ~45-55 MB |
| x86 APK | ~40-50 MB |
| AAB (all architectures) | ~75-95 MB |

## Updating the Workflow

To upload all architecture-specific APKs to GitHub Releases, update `.github/workflows/build-and-release.yml`:

### Current Workflow (Single APK)
The current workflow expects a single APK file with a predictable name.

### Updated Workflow (Multiple APKs)
To handle multiple APKs, the workflow needs to:

1. Find all generated APK files
2. Rename them with version numbers
3. Upload all of them to the release

Example workflow changes:

```yaml
- name: Find and organize APKs
  run: |
    VERSION="${{ steps.version.outputs.version }}"
    
    # Find all APK files in the output directory
    mkdir -p apks-to-release
    
    # Copy and rename APKs with version numbers
    for apk in *.apk; do
      if [ -f "$apk" ]; then
        # Extract architecture from filename (e.g., app-arm64-v8a-release.apk)
        arch=$(echo "$apk" | sed -n 's/.*-\(arm64-v8a\|armeabi-v7a\|x86_64\|x86\)-.*/\1/p')
        if [ -n "$arch" ]; then
          cp "$apk" "apks-to-release/pars-en-cours-v${VERSION}-${arch}.apk"
        fi
      fi
    done
    
    # List what we're releasing
    ls -lh apks-to-release/

- name: Generate checksums
  run: |
    cd apks-to-release
    for apk in *.apk; do
      sha256sum "$apk" > "${apk}.sha256"
      md5sum "$apk" > "${apk}.md5"
    done

- name: Create Release
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    tag: ${{ github.ref_name }}
  run: |
    gh release create "$tag" \
      --repo="$GITHUB_REPOSITORY" \
      --title="Release ${tag#v}" \
      --notes-file /tmp/release_notes.md \
      apks-to-release/*
```

## Universal APK (Optional)

If you want to also create a universal APK (contains all architectures), set `universalApk true`:

```gradle
splits {
    abi {
        enable true
        reset()
        include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        universalApk true  // Changed to true
    }
}
```

This will create 5 APKs: 4 architecture-specific + 1 universal.

## Testing

To test that splits are working correctly:

1. Build the APKs locally:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

2. Check the output directory:
   ```bash
   ls -lh app/build/outputs/apk/release/
   ```

3. You should see 4 APK files (or 5 if universalApk is enabled)

## Troubleshooting

### Issue: Only one APK is generated

**Cause**: The `splits` configuration might not be properly placed in the `android` block.

**Solution**: Ensure the `splits` block is inside the `android { }` block, before `buildTypes`.

### Issue: EAS build doesn't find the APKs

**Cause**: EAS expects a specific filename pattern.

**Solution**: Use a custom `gradleCommand` in `eas.json` or update the workflow to handle multiple files.

### Issue: Version codes conflict

**Cause**: The `abiCodes` mapping might not be applied correctly.

**Solution**: Verify the version code override code is after the `splits` block and uses `android.applicationVariants.all`.

## Best Practices

1. **Always provide arm64-v8a**: This is the most common modern architecture
2. **Consider dropping x86/x86_64**: Very few devices use these architectures
3. **Test on real devices**: Emulators might not accurately represent real-world performance
4. **Monitor download sizes**: Track APK sizes over time to catch bloat
5. **Use AAB for Play Store**: Let Google handle the splitting automatically

## Resources

- [Android Developer Guide: Configure APK Splits](https://developer.android.com/studio/build/configure-apk-splits)
- [Android Developer Guide: Android App Bundles](https://developer.android.com/guide/app-bundle)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

