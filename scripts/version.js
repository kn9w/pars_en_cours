#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function getCurrentVersion() {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  return appJson.expo.version;
}

function updateVersion(newVersion) {
  // Update app.json
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  appJson.expo.version = newVersion;
  fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');

  // Update package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`✅ Updated version to ${newVersion} in app.json and package.json`);
}

function createGitTag(version) {
  const tagName = `v${version}`;
  
  try {
    // Check if tag already exists
    execSync(`git tag -l "${tagName}"`, { stdio: 'pipe' });
    console.log(`⚠️  Tag ${tagName} already exists`);
    return false;
  } catch (error) {
    // Tag doesn't exist, create it
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);
    console.log(`✅ Created git tag: ${tagName}`);
    return true;
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  switch (command) {
    case 'get':
      console.log(`Current version: ${getCurrentVersion()}`);
      break;
    
    case 'set':
      if (!version) {
        console.error('❌ Please provide a version number (e.g., 1.0.0)');
        process.exit(1);
      }
      updateVersion(version);
      break;
    
    case 'release':
      if (!version) {
        console.error('❌ Please provide a version number (e.g., 1.0.0)');
        process.exit(1);
      }
      updateVersion(version);
      const tagCreated = createGitTag(version);
      if (tagCreated) {
        console.log(`\n🚀 To push the tag and trigger the build:`);
        console.log(`   git push origin v${version}`);
      }
      break;
    
    case 'patch':
      const currentVersion = getCurrentVersion();
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      const newPatchVersion = `${major}.${minor}.${patch + 1}`;
      updateVersion(newPatchVersion);
      const patchTagCreated = createGitTag(newPatchVersion);
      if (patchTagCreated) {
        console.log(`\n🚀 To push the tag and trigger the build:`);
        console.log(`   git push origin v${newPatchVersion}`);
      }
      break;
    
    case 'minor':
      const currentMinorVersion = getCurrentVersion();
      const [majorMinor, minorMinor, patchMinor] = currentMinorVersion.split('.').map(Number);
      const newMinorVersion = `${majorMinor}.${minorMinor + 1}.0`;
      updateVersion(newMinorVersion);
      const minorTagCreated = createGitTag(newMinorVersion);
      if (minorTagCreated) {
        console.log(`\n🚀 To push the tag and trigger the build:`);
        console.log(`   git push origin v${newMinorVersion}`);
      }
      break;
    
    case 'major':
      const currentMajorVersion = getCurrentVersion();
      const [majorMajor, minorMajor, patchMajor] = currentMajorVersion.split('.').map(Number);
      const newMajorVersion = `${majorMajor + 1}.0.0`;
      updateVersion(newMajorVersion);
      const majorTagCreated = createGitTag(newMajorVersion);
      if (majorTagCreated) {
        console.log(`\n🚀 To push the tag and trigger the build:`);
        console.log(`   git push origin v${newMajorVersion}`);
      }
      break;
    
    default:
      console.log(`
📦 Version Management Script

Usage:
  node scripts/version.js <command> [version]

Commands:
  get                    - Show current version
  set <version>          - Set version in app.json and package.json
  release <version>      - Set version and create git tag
  patch                  - Increment patch version (1.0.0 → 1.0.1)
  minor                  - Increment minor version (1.0.0 → 1.1.0)
  major                  - Increment major version (1.0.0 → 2.0.0)

Examples:
  node scripts/version.js get
  node scripts/version.js set 1.2.3
  node scripts/version.js release 1.2.3
  node scripts/version.js patch
      `);
  }
}

main();
