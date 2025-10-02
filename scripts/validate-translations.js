#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get the project root directory
const projectRoot = path.join(__dirname, '..');
const localesDir = path.join(projectRoot, 'src', 'i18n', 'locales');

// Read translation files
const enFile = path.join(localesDir, 'en.json');
const frFile = path.join(localesDir, 'fr.json');

if (!fs.existsSync(enFile) || !fs.existsSync(frFile)) {
  console.error('Translation files not found!');
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frFile, 'utf8'));

// Flatten nested object to dot notation keys
function flattenObject(obj, prefix = '') {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      keys.push(newKey);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...flattenObject(value, newKey));
    }
  }
  
  return keys;
}

// Get all translation keys from an object
function getAllKeys(obj) {
  return flattenObject(obj);
}

// Find missing keys between two translation objects
function findMissingKeys(reference, target) {
  const referenceKeys = new Set(getAllKeys(reference));
  const targetKeys = new Set(getAllKeys(target));
  
  return Array.from(referenceKeys).filter(key => !targetKeys.has(key));
}

// Find extra keys in target that don't exist in reference
function findExtraKeys(reference, target) {
  const referenceKeys = new Set(getAllKeys(reference));
  const targetKeys = new Set(getAllKeys(target));
  
  return Array.from(targetKeys).filter(key => !referenceKeys.has(key));
}

// Validate translation completeness
function validateTranslations() {
  console.log('Validating translations...\n');
  
  const enKeys = getAllKeys(en);
  const frKeys = getAllKeys(fr);
  
  console.log(`Translation Statistics:`);
  console.log(`English: ${enKeys.length} keys`);
  console.log(`French:  ${frKeys.length} keys\n`);
  
  // Check for missing keys in French
  const missingInFrench = findMissingKeys(en, fr);
  if (missingInFrench.length > 0) {
    console.log('Missing keys in French:');
    missingInFrench.forEach(key => console.log(`   - ${key}`));
    console.log('');
  }
  
  // Check for extra keys in French
  const extraInFrench = findExtraKeys(en, fr);
  if (extraInFrench.length > 0) {
    console.log('Extra keys in French (not in English):');
    extraInFrench.forEach(key => console.log(`   - ${key}`));
    console.log('');
  }
  
  // Check for missing keys in English
  const missingInEnglish = findMissingKeys(fr, en);
  if (missingInEnglish.length > 0) {
    console.log('Missing keys in English:');
    missingInEnglish.forEach(key => console.log(`   - ${key}`));
    console.log('');
  }
  
  // Summary
  const totalIssues = missingInFrench.length + extraInFrench.length + missingInEnglish.length;
  
  if (totalIssues === 0) {
    console.log('All translations are complete and consistent!');
  } else {
    console.log(`Found ${totalIssues} translation issues that need to be fixed.`);
  }
  
  return {
    isValid: totalIssues === 0,
    missingInFrench,
    extraInFrench,
    missingInEnglish,
    totalIssues,
  };
}

// Run validation
validateTranslations();
