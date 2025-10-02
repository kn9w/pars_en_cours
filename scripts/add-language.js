#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get language code from command line arguments
const languageCode = process.argv[2];

if (!languageCode) {
  console.error('Please provide a language code (e.g., "es" for Spanish)');
  console.log('Usage: node scripts/add-language.js <language-code>');
  process.exit(1);
}

// Validate language code format
if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(languageCode)) {
  console.error('Invalid language code format. Use format like "en", "fr", "es", "pt-BR"');
  process.exit(1);
}

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const enFile = path.join(localesDir, 'en.json');
const newFile = path.join(localesDir, `${languageCode}.json`);

// Check if language already exists
if (fs.existsSync(newFile)) {
  console.error(`Language "${languageCode}" already exists!`);
  process.exit(1);
}

// Read English translations as template
if (!fs.existsSync(enFile)) {
  console.error('English translations not found!');
  process.exit(1);
}

const enTranslations = JSON.parse(fs.readFileSync(enFile, 'utf8'));

// Create new language file with English as template
fs.writeFileSync(newFile, JSON.stringify(enTranslations, null, 2));

console.log(`Created new language file: ${newFile}`);
console.log(`Please translate the content in ${newFile} to ${languageCode}`);
console.log(`Run "npm run validate-translations" to check for missing translations`);

// Update i18n configuration
const i18nConfigFile = path.join(__dirname, '..', 'src', 'i18n', 'index.ts');
let i18nConfig = fs.readFileSync(i18nConfigFile, 'utf8');

// Add import for new language
const importRegex = /(import fr from '\.\/locales\/fr\.json';)/;
const newImport = `import ${languageCode} from './locales/${languageCode}.json';`;
i18nConfig = i18nConfig.replace(importRegex, `$1\n${newImport}`);

// Add to resources
const resourcesRegex = /(resources: \{\s*en: \{ translation: en \},\s*fr: \{ translation: fr \},)/;
const newResource = `resources: {\n    en: { translation: en },\n    fr: { translation: fr },\n    ${languageCode}: { translation: ${languageCode} },`;
i18nConfig = i18nConfig.replace(resourcesRegex, newResource);

// Add to supported languages
const supportedLngsRegex = /(supportedLngs: \['en', 'fr'\])/;
i18nConfig = i18nConfig.replace(supportedLngsRegex, `supportedLngs: ['en', 'fr', '${languageCode}']`);

fs.writeFileSync(i18nConfigFile, i18nConfig);

console.log(`Updated i18n configuration to include ${languageCode}`);
console.log(`You can now use the new language in your app!`);
