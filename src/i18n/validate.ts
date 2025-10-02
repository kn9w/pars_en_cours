const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'fr.json'), 'utf8'));

// Type for nested object structure
type NestedObject = { [key: string]: string | NestedObject };

// Flatten nested object to dot notation keys
function flattenObject(obj: NestedObject, prefix = ''): string[] {
  const keys: string[] = [];
  
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
function getAllKeys(obj: NestedObject): string[] {
  return flattenObject(obj);
}

// Find missing keys between two translation objects
function findMissingKeys(reference: NestedObject, target: NestedObject): string[] {
  const referenceKeys = new Set(getAllKeys(reference));
  const targetKeys = new Set(getAllKeys(target));
  
  return Array.from(referenceKeys).filter(key => !targetKeys.has(key));
}

// Find extra keys in target that don't exist in reference
function findExtraKeys(reference: NestedObject, target: NestedObject): string[] {
  const referenceKeys = new Set(getAllKeys(reference));
  const targetKeys = new Set(getAllKeys(target));
  
  return Array.from(targetKeys).filter(key => !referenceKeys.has(key));
}

// Validate translation completeness
export function validateTranslations() {
  console.log('🔍 Validating translations...\n');
  
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

// Export validation function for use in scripts
module.exports = { validateTranslations };
