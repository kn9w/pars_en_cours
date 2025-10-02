/**
 * Validation utilities for forms and user input
 */

import type { DirectMessage } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Check if a message was sent by the current user
 */
export const isMessageSender = (message: DirectMessage, userPubkey: string): boolean => {
  return message.senderPubkey === userPubkey;
};

/**
 * Create a deterministic conversation ID from participant pubkeys
 * @deprecated Use createConversationKey from nip04.ts instead
 */
export const createConversationId = (pubkey1: string, pubkey2: string): string => {
  return [pubkey1, pubkey2].sort().join(':');
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate post title
 */
export const validatePostTitle = (title: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!title.trim()) {
    errors.push('Title is required');
  } else if (title.trim().length < 5) {
    errors.push('Title must be at least 5 characters');
  } else if (title.trim().length > 100) {
    errors.push('Title must be less than 100 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate post description
 */
export const validatePostDescription = (description: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!description.trim()) {
    errors.push('Description is required');
  } else if (description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  } else if (description.trim().length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate donation amount
 */
export const validateAmount = (amount: number | undefined): ValidationResult => {
  const errors: string[] = [];
  
  if (amount !== undefined) {
    if (amount <= 0) {
      errors.push('Amount must be greater than 0');
    } else if (amount > 10000) {
      errors.push('Amount must be less than $10,000');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate user name
 */
export const validateName = (name: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!name.trim()) {
    errors.push('Name is required');
  } else if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (name.trim().length > 50) {
    errors.push('Name must be less than 50 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate university name
 */
export const validateUniversity = (university: string | undefined, isStudent: boolean): ValidationResult => {
  const errors: string[] = [];
  
  if (isStudent) {
    if (!university?.trim()) {
      errors.push('University is required for students');
    } else if (university.trim().length < 2) {
      errors.push('University name must be at least 2 characters');
    } else if (university.trim().length > 100) {
      errors.push('University name must be less than 100 characters');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate category selection
 */
export const validateCategory = (category: string): ValidationResult => {
  const errors: string[] = [];
  const validCategories = [
    'Education',
    'Food',
    'Housing',
    'Transportation',
    'Healthcare',
    'Technology',
    'Clothing',
    'Books',
    'Other',
  ];
  
  if (!category.trim()) {
    errors.push('Category is required');
  } else if (!validCategories.includes(category)) {
    errors.push('Please select a valid category');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Comprehensive form validation
 */
export const validateCreatePostForm = (form: {
  type: 'ask' | 'give';
  title: string;
  description: string;
  category: string;
  amount?: number;
}): ValidationResult => {
  const allErrors: string[] = [];
  
  // Validate title
  const titleValidation = validatePostTitle(form.title);
  allErrors.push(...titleValidation.errors);
  
  // Validate description
  const descriptionValidation = validatePostDescription(form.description);
  allErrors.push(...descriptionValidation.errors);
  
  // Validate category
  const categoryValidation = validateCategory(form.category);
  allErrors.push(...categoryValidation.errors);
  
  // Validate amount if provided
  if (form.amount !== undefined) {
    const amountValidation = validateAmount(form.amount);
    allErrors.push(...amountValidation.errors);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
};

/**
 * Validate onboarding form
 */
export const validateOnboardingForm = (form: {
  name: string;
  isStudent: boolean;
  university?: string;
  bio?: string;
}): ValidationResult => {
  const allErrors: string[] = [];
  
  // Validate name
  const nameValidation = validateName(form.name);
  allErrors.push(...nameValidation.errors);
  
  // Validate university if student
  const universityValidation = validateUniversity(form.university, form.isStudent);
  allErrors.push(...universityValidation.errors);
  
  // Validate bio if provided
  if (form.bio && form.bio.trim()) {
    if (form.bio.trim().length > 300) {
      allErrors.push('Bio must be less than 300 characters');
    }
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
};
