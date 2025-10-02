// Common approach: Define translations as nested objects directly

export const en = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    continue: 'Continue',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    create: 'Create',
    youSelected: 'You have chosen to',
    import: 'Import',
    getStarted: 'Get Started',
    copy: 'Copy',
    copied: 'Copied!',
  },
  
  app: {
    name: 'Pars en Cours',
    tagline: 'Connecting students in need of transportation with those who can help',
  },
  
  navigation: {
    messages: 'Messages',
    map: 'Map',
    profile: 'Profile',
  },
  
  onboarding: {
    step1: {
      title: 'Pars en Cours',
      studentButton: 'I am a student',
      nonStudentButton: 'I am not a student',
    },
    step2: {
      title: 'How to use the app',
      subtitle: 'Discover the main features and how to navigate',
      askFeature: {
        title: 'Ask for help',
        description: 'Request donations or assistance from the community. This icon lets you create a help request.',
      },
      giveFeature: {
        title: 'Give donations',
        description: 'Offer help, resources, or donations to those in need. This icon lets you create a donation offer.',
      },
      mapFeature: {
        title: 'Explore the map',
        description_student: 'Find donations and requests for help near you.',
        description_not_student: 'Find requests for help near you.'
      },
      messagesFeature: {
        title: 'Stay connected',
        description: 'Communicate with other users through private messages.',
      },
      studentAdditionalFeatures: 'As a student, you can also:',
      additionalFeatures: 'You can also:',
      getStartedButton: 'Get Started',
    },
    step3: {
      title: 'Create Your Account',
      subtitle: 'Set up your nostr identity to start',
      explanation: {
        title: 'What is Nostr?',
        description: 'Nostr is a decentralized protocol that gives you full control over your identity and data.',
        relays: {
          title: 'Relays',
          description: 'Your posts are distributed across multiple relay servers, ensuring your data remains available even if some relays go offline.',
        },
        publicKey: {
          title: 'Public Key = Username',
          description: 'Your public key is your unique identifier that others can use to find and verify your posts.',
        },
        privateKey: {
          title: 'Private Key = Password',
          description: 'Your private key signs your posts and proves they\'re from you.',
          warning: ' Keep it secret and secure - it cannot be changed if lost!',
        },
      },
      keyGeneration: {
        chooseOption: 'Choose an option:',
        generateNew: 'Generate a pair of keys',
        generating: 'Generating...',
        importExisting: 'Import Existing Keys',
        importLabel: 'Enter your private key (nsec or hex):',
        importPlaceholder: 'nsec1... or private key hex',
        yourKeys: 'Your Nostr Keys:',
        publicKeyLabel: 'Public Key (Username):',
        privateKeyLabel: 'Private Key (Keep Secret!):',
        warningMessage: 'Save your private key safely! If you lose it, you\'ll lose access to your account permanently.',
      },
      alerts: {
        keysGenerated: {
          title: 'Keys Generated!',
          message: 'Your Nostr keys have been generated. Please save your private key securely - you\'ll need it to access your account.',
        },
        generateError: {
          title: 'Error',
          message: 'Failed to generate keys. Please try again.',
        },
        importError: {
          title: 'Error',
          message: 'Please enter a private key.',
        },
        invalidKey: {
          title: 'Error',
          message: 'Invalid private key format. Please enter a valid nsec key or hex string.',
        },
        importSuccess: {
          title: 'Success!',
          message: 'Your keys have been imported successfully.',
        },
        importFailed: {
          title: 'Error',
          message: 'Failed to import keys. Please check your private key and try again.',
        },
        copySuccess: {
          title: 'Copied!',
          message: '{keyType} key copied to clipboard.',
        },
        copyError: {
          title: 'Error',
          message: 'Failed to copy key to clipboard.',
        },
      },
    },
    progress: '{current} of {total}',
  },
  
  map: {
    title: 'Map',
    searchPlaceholder: 'Search...',
    noMarkersFound: 'No markers found',
    createRequestTitle: 'Create request',
    createDonationTitle: 'Create donation',
    createRequestMessage: 'You have chosen to ask for help',
    createDonationMessage: 'You have chosen to offer help',
    offlineMode: 'Offline mode (France)',
    onlineMode: 'Online mode',
    updating: 'Updating France tiles... {progress}%',
  },
  
  messages: {
    title: 'Messages',
    subtitle: 'Stay in touch with the community',
    noMessages: 'No messages yet',
    startConversation: 'Start a conversation by interacting with posts on the map!',
  },
  
  profile: {
    title: 'Profile',
    subtitle: 'Manage your account and posts',
    resetOnboarding: 'Reset onboarding (Debug)',
    resetOnboardingConfirm: {
      title: 'Reset onboarding',
      message: 'This will restart the onboarding process. Are you sure?',
      reset: 'Reset',
      successTitle: 'Success',
      successMessage: 'Onboarding has been reset. Restart the app to see the onboarding process.',
      errorTitle: 'Error',
      errorMessage: 'Failed to reset onboarding',
    },
    stats: {
      requests: 'Requests',
      donations: 'Donations',
      successRate: 'Success rate',
    }
  },
  
  fab: {
    ask: 'Ask',
    give: 'Give',
  },
  
  posts: {
    ask: 'Ask',
    give: 'Give',
    request: 'Request',
    donation: 'Donation',
    askForHelp: 'ask for help',
    offerHelp: 'offer help',
  },
  
  settings: {
    title: 'Settings',
    theme: {
      title: 'Theme',
      description: 'Choose your preferred app theme',
      light: 'Light',
      lightDescription: 'Always use light theme',
      dark: 'Dark',
      darkDescription: 'Always use dark theme',
      auto: 'Auto',
      autoDescription: 'Follow system preference',
    },
    language: {
      title: 'Language',
      description: 'Choose your preferred language',
      english: 'English',
      french: 'French',
    },
    relays: {
      title: 'Relays',
      description: 'Manage your Nostr relay connections',
      addRelay: 'Add Relay',
      relayUrl: 'Relay URL',
      relayName: 'Relay Name (Optional)',
      addRelayPlaceholder: 'wss://relay.example.com',
      addRelayNamePlaceholder: 'My Relay',
      addRelayError: 'Failed to add relay',
      addRelaySuccess: 'Relay added successfully',
      removeRelay: 'Remove Relay',
      removeRelayConfirm: {
        title: 'Remove Relay',
        message: 'Are you sure you want to remove this relay?',
        remove: 'Remove',
        cancel: 'Cancel',
      },
      testRelay: 'Test Connection',
      testRelaySuccess: 'Relay is working',
      testRelayError: 'Relay connection failed',
      status: {
        connected: 'Connected',
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        error: 'Error',
      },
      permissions: {
        read: 'Read',
        write: 'Write',
      },
      lastConnected: 'Last connected: {time}',
      never: 'Never',
    },
    debug: {
      title: 'Debug',
      description: 'Development and debugging options',
    },
    resetOnboarding: 'Reset onboarding (Debug)',
    resetOnboardingConfirm: {
      title: 'Reset onboarding',
      message: 'This will restart the onboarding process. Are you sure?',
      reset: 'Reset',
      successTitle: 'Success',
      successMessage: 'Onboarding has been reset. Restart the app to see the onboarding process.',
      errorTitle: 'Error',
      errorMessage: 'Failed to reset onboarding',
    },
    logout: 'Log Out',
    logoutConfirm: {
      title: 'Log Out',
      message: 'Are you sure you want to log out? You will need to log in again to access your account.',
      logout: 'Log Out',
      cancel: 'Cancel',
    },
  },
} as const;

export const fr = {
  common: {
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    cancel: 'Annuler',
    continue: 'Continuer',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    save: 'Sauvegarder',
    edit: 'Modifier',
    delete: 'Supprimer',
    confirm: 'Confirmer',
    yes: 'Oui',
    no: 'Non',
    create: 'Créer',
    youSelected: 'Vous avez choisi de',
    import: 'Importer',
    getStarted: 'Commencer',
    copy: 'Copier',
    copied: 'Copié !',
  },
  
  app: {
    name: 'Pars en Cours',
    tagline: 'Connecter les étudiants dans le besoin de mobilité avec ceux qui peuvent aider',
  },
  
  navigation: {
    messages: 'Messages',
    map: 'Carte',
    profile: 'Profil',
  },
  
  onboarding: {
    step1: {
      title: 'Pars en Cours',
      studentButton: 'Je suis étudiant',
      nonStudentButton: 'Je ne suis pas étudiant',
    },
    step2: {
      title: 'Comment utiliser l\'application',
      subtitle: 'Découvrez les principales fonctionnalités et comment naviguer',
      askFeature: {
        title: 'Demander de l\'aide',
        description: 'Demandez des dons ou de l\'assistance. Cette icône permet de faire une demande d\'aide.',
      },
      giveFeature: {
        title: 'Faire un don',
        description: 'Faites un don directement à un(e) étudiant(e). Cette icône permet de créer une offre de don.',
      },
      mapFeature: {
        title: 'Explorer la carte',
        description_student: 'Trouvez des dons et des demandes d\'aide près de chez vous.',
        description_not_student: 'Trouvez des demandes d\'aide près de chez vous.',
      },
      messagesFeature: {
        title: 'Rester connecté',
        description: 'Échangez avec d\'autres utilisateurs par messages privés.',
      },
      studentAdditionalFeatures: 'En tant qu\'étudiant, vous pouvez aussi :',
      additionalFeatures: 'Vous pouvez aussi :',
      getStartedButton: 'Commencer',
    },
    step3: {
      title: 'Créez votre compte',
      subtitle: 'Générez votre identité nostr pour commencer',
      explanation: {
        title: 'Qu\'est-ce que Nostr ?',
        description: 'Nostr est un protocole décentralisé qui vous donne un contrôle total sur votre identité et vos données.',
        relays: {
          title: 'Relais',
          description: 'Vos publications sont distribuées sur plusieurs serveurs relais, garantissant que vos données restent disponibles même si certains relais tombent en panne.',
        },
        publicKey: {
          title: 'Clé publique = Nom d\'utilisateur',
          description: 'Votre clé publique est votre identifiant unique que les autres peuvent utiliser pour trouver et vérifier vos publications.',
        },
        privateKey: {
          title: 'Clé privée = Mot de passe',
          description: 'Votre clé privée signe vos publications et prouve qu\'elles viennent de vous.',
          warning: ' Gardez-la secrète et sécurisée - elle ne peut pas être changée si elle est perdue !',
        },
      },
      keyGeneration: {
        chooseOption: 'Choisissez une option :',
        generateNew: 'Générer une paire de clés',
        generating: 'Génération...',
        importExisting: 'Importer des clés existantes',
        importLabel: 'Entrez votre clé privée (nsec ou hex) :',
        importPlaceholder: 'nsec1... ou clé privée hex',
        yourKeys: 'Vos clés Nostr :',
        publicKeyLabel: 'Clé publique (Nom d\'utilisateur) :',
        privateKeyLabel: 'Clé privée (Gardez secret !) :',
        warningMessage: 'Sauvegardez votre clé privée en sécurité ! Si vous la perdez, vous perdrez définitivement l\'accès à votre compte.',
      },
      alerts: {
        keysGenerated: {
          title: 'Clés générées !',
          message: 'Vos clés Nostr ont été générées. Veuillez sauvegarder votre clé privée en sécurité - vous en aurez besoin pour accéder à votre compte.',
        },
        generateError: {
          title: 'Erreur',
          message: 'Échec de la génération des clés. Veuillez réessayer.',
        },
        importError: {
          title: 'Erreur',
          message: 'Veuillez entrer une clé privée.',
        },
        invalidKey: {
          title: 'Erreur',
          message: 'Format de clé privée invalide. Veuillez entrer une clé nsec valide ou une chaîne hex.',
        },
        importSuccess: {
          title: 'Succès !',
          message: 'Vos clés ont été importées avec succès.',
        },
        importFailed: {
          title: 'Erreur',
          message: 'Échec de l\'importation des clés. Veuillez vérifier votre clé privée et réessayer.',
        },
        copySuccess: {
          title: 'Copié !',
          message: 'Clé {keyType} copiée dans le presse-papiers.',
        },
        copyError: {
          title: 'Erreur',
          message: 'Échec de la copie de la clé dans le presse-papiers.',
        },
      },
    },
    progress: '{current} de {total}',
  },
  
  map: {
    title: 'Carte',
    searchPlaceholder: 'Rechercher...',
    noMarkersFound: 'Aucun marqueur trouvé',
    createRequestTitle: 'Créer une demande',
    createDonationTitle: 'Créer un don',
    createRequestMessage: 'Vous avez choisi de demander de l\'aide',
    createDonationMessage: 'Vous avez choisi d\'offrir de l\'aide',
    offlineMode: 'Mode hors ligne (France)',
    onlineMode: 'Mode en ligne',
    updating: 'Mise à jour des tuiles France... {progress}%',
  },
  
  messages: {
    title: 'Messages',
    subtitle: 'Restez en contact avec la communauté',
    noMessages: 'Aucun message pour le moment',
    startConversation: 'Commencez une conversation en interagissant avec les publications sur la carte !',
  },
  
  profile: {
    title: 'Profil',
    subtitle: 'Gérez votre compte et vos publications',
    resetOnboarding: 'Réinitialiser l\'intégration (Debug)',
    resetOnboardingConfirm: {
      title: 'Réinitialiser l\'intégration',
      message: 'Cela redémarrera le processus d\'intégration. Êtes-vous sûr ?',
      reset: 'Réinitialiser',
      successTitle: 'Succès',
      successMessage: 'L\'intégration a été réinitialisée. Redémarrez l\'application pour voir le processus d\'intégration.',
      errorTitle: 'Erreur',
      errorMessage: 'Échec de la réinitialisation de l\'intégration',
    },
    stats: {
      requests: 'Demandes',
      donations: 'Dons',
      successRate: 'Taux de réussite',
    },
  },
  
  fab: {
    ask: 'Demander',
    give: 'Donner',
  },
  
  posts: {
    ask: 'Demander',
    give: 'Donner',
    request: 'Demande',
    donation: 'Don',
    askForHelp: 'demander de l\'aide',
    offerHelp: 'offrir de l\'aide',
  },
  
  settings: {
    title: 'Paramètres',
    theme: {
      title: 'Thème',
      description: 'Choisissez votre thème d\'application préféré',
      light: 'Clair',
      lightDescription: 'Toujours utiliser le thème clair',
      dark: 'Sombre',
      darkDescription: 'Toujours utiliser le thème sombre',
      auto: 'Automatique',
      autoDescription: 'Suivre les préférences du système',
    },
    language: {
      title: 'Langue',
      description: 'Choisissez votre langue préférée',
      english: 'Anglais',
      french: 'Français',
    },
    relays: {
      title: 'Relais',
      description: 'Gérez vos connexions aux relais Nostr',
      addRelay: 'Ajouter un Relais',
      relayUrl: 'URL du Relais',
      relayName: 'Nom du Relais (Optionnel)',
      addRelayPlaceholder: 'wss://relay.exemple.com',
      addRelayNamePlaceholder: 'Mon Relais',
      addRelayError: 'Échec de l\'ajout du relais',
      addRelaySuccess: 'Relais ajouté avec succès',
      removeRelay: 'Supprimer le Relais',
      removeRelayConfirm: {
        title: 'Supprimer le Relais',
        message: 'Êtes-vous sûr de vouloir supprimer ce relais ?',
        remove: 'Supprimer',
        cancel: 'Annuler',
      },
      testRelay: 'Tester la Connexion',
      testRelaySuccess: 'Le relais fonctionne',
      testRelayError: 'Échec de la connexion au relais',
      status: {
        connected: 'Connecté',
        disconnected: 'Déconnecté',
        connecting: 'Connexion...',
        error: 'Erreur',
      },
      permissions: {
        read: 'Lecture',
        write: 'Écriture',
      },
      lastConnected: 'Dernière connexion : {time}',
      never: 'Jamais',
    },
    debug: {
      title: 'Débogage',
      description: 'Options de développement et de débogage',
    },
    resetOnboarding: 'Réinitialiser l\'intégration (Debug)',
    resetOnboardingConfirm: {
      title: 'Réinitialiser l\'intégration',
      message: 'Cela redémarrera le processus d\'intégration. Êtes-vous sûr ?',
      reset: 'Réinitialiser',
      successTitle: 'Succès',
      successMessage: 'L\'intégration a été réinitialisée. Redémarrez l\'application pour voir le processus d\'intégration.',
      errorTitle: 'Erreur',
      errorMessage: 'Échec de la réinitialisation de l\'intégration',
    },
    logout: 'Se Déconnecter',
    logoutConfirm: {
      title: 'Se Déconnecter',
      message: 'Êtes-vous sûr de vouloir vous déconnecter ? Vous devrez vous reconnecter pour accéder à votre compte.',
      logout: 'Se Déconnecter',
      cancel: 'Annuler',
    },
  },
} as const; // 'as const' for better type inference

// Auto-generate types from the translation object
export type TranslationKeys = typeof en;

// Supported languages
export type Language = 'en' | 'fr';
export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'app_language';

// Translations object
export const translations = {
  en,
  fr,
} as const;

export type Translations = typeof translations[Language];
