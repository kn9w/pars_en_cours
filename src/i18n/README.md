# Internationalization (i18n) System

This project uses `react-i18next` for internationalization.

## 🌍 Supported Languages

- **English (en)** - Default language
- **French (fr)** - Complete translation

## 📁 File Structure

```
src/i18n/
├── index.ts              # i18next configuration
├── hooks.ts              # React hooks for translations
├── validate.ts           # TypeScript validation utilities
├── locales/
│   ├── en.json          # English translations
│   └── fr.json          # French translations
└── README.md            # This documentation
```

## 🚀 Usage in Components

### Basic Translation

```tsx
import { useTranslations } from '../i18n/hooks';

const MyComponent = () => {
  const t = useTranslations();
  
  return (
    <Text>{t('common.loading')}</Text>
  );
};
```

### With Interpolation

```tsx
import { useLocalization } from '../i18n/hooks';

const MyComponent = () => {
  const { t } = useLocalization();
  
  return (
    <Text>{t('onboarding.progress', { current: 1, total: 3 })}</Text>
  );
};
```

### Language Switching

```tsx
import { useLocalization } from '../i18n/hooks';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLocalization();
  
  return (
    <Button onPress={() => setLanguage('fr')}>
      Switch to French
    </Button>
  );
};
```

## 🔧 Adding a New Language

### Method 1: Using the Script (Recommended)

```bash
npm run add-language es
```

This will:
- Create `src/i18n/locales/es.json` with English as template
- Update the i18n configuration
- Add the language to supported languages

### Method 2: Manual Setup

1. **Create translation file**: `src/i18n/locales/[language-code].json`
2. **Update i18n configuration** in `src/i18n/index.ts`:
   ```typescript
   import [lang] from './locales/[language-code].json';
   
   // Add to resources
   resources: {
     en: { translation: en },
     fr: { translation: fr },
     [lang]: { translation: [lang] },
   }
   
   // Add to supported languages
   supportedLngs: ['en', 'fr', '[language-code]']
   ```

## 📝 Contributing Translations

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/pars-en-cours.git
cd pars-en-cours
npm install
```

### 2. Add Your Language

```bash
npm run add-language [your-language-code]
```

### 3. Translate

Edit the generated JSON file in `src/i18n/locales/[language-code].json`:

```json
{
  "common": {
    "loading": "Cargando...",
    "error": "Error",
    "success": "Éxito"
  },
  "app": {
    "name": "Pars en Cours",
    "tagline": "Conectando estudiantes que necesitan transporte con aquellos que pueden ayudar"
  }
}
```

### 4. Validate

```bash
npm run validate-translations
```

### 5. Test

```bash
npm start
```

### 6. Submit Pull Request

1. Commit your changes
2. Push to your fork
3. Create a pull request

## 🔍 Translation Validation

### Automatic Validation

```bash
npm run validate-translations
```

This checks for:
- Missing translation keys
- Extra keys not in reference language
- Consistency between languages

### Manual Validation

```typescript
import { validateTranslations } from '../i18n/validate';

const result = validateTranslations();
console.log(result.isValid); // true if all translations are complete
```

## 📋 Translation Guidelines

### Key Naming Convention

Use dot notation for nested keys:

```json
{
  "onboarding": {
    "step1": {
      "title": "Welcome",
      "subtitle": "Get started with the app"
    }
  }
}
```

### Interpolation

Use double curly braces for variables:

```json
{
  "onboarding": {
    "progress": "{{current}} of {{total}}"
  }
}
```

### Pluralization

i18next supports pluralization:

```json
{
  "messages": {
    "count_zero": "No messages",
    "count_one": "{{count}} message",
    "count_other": "{{count}} messages"
  }
}
```

### Special Characters

- Use proper Unicode characters (é, ñ, ü, etc.)
- Avoid HTML entities
- Use proper quotation marks (" " instead of " ")

## 🐛 Troubleshooting

### Missing Translations

If you see `[Missing: key.path]` in the app:

1. Check if the key exists in English (`en.json`)
2. Add the missing translation to your language file
3. Run validation: `npm run validate-translations`

### TypeScript Errors

If you get TypeScript errors:

1. Make sure you're importing from `../i18n/hooks`
2. Check that the translation key exists
3. Restart your TypeScript server

### Language Not Switching

If language switching doesn't work:

1. Check that the language is in `supportedLngs`
2. Verify the language file exists
3. Check browser/app language settings

## 🔗 Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [Expo Localization](https://docs.expo.dev/versions/latest/sdk/localization/)

## 🤝 Need Help?

- Open an issue on GitHub
- Check existing issues for similar problems
- Join our community discussions

---

**Thank you for helping make this app accessible to more people! 🌍**
