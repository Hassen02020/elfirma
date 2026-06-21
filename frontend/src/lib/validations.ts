// Validation schemas for EL FIRMA Caisse Management
// Note: For production, install zod with: npm install zod

interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  regex?: RegExp;
  enum?: string[];
  message?: string;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
}

// Truck validation schema
export const truckSchema: ValidationSchema = {
  serie: { required: true, min: 1, max: 50 },
  matricule: { required: true, min: 1, max: 50 },
  modele: { max: 100 },
  chauffeurId: {},
  capaciteMax: { required: true, min: 1 },
  statut: { required: true, enum: ['ACTIF', 'INACTIF', 'EN_MAINTENANCE'] }
};

export interface TruckFormData {
  serie: string;
  matricule: string;
  modele?: string;
  chauffeurId?: string;
  capaciteMax: string;
  statut: 'ACTIF' | 'INACTIF' | 'EN_MAINTENANCE';
}

// Driver validation schema
export const driverSchema: ValidationSchema = {
  nom: { required: true, min: 1, max: 100 },
  prenom: { max: 100 },
  codeEmploye: { required: true, min: 1, max: 50, regex: /^[A-Z0-9]+$/ },
  telephone: { max: 20 },
  statut: { required: true, enum: ['ACTIF', 'INACTIF', 'EN_CONGE'] }
};

export interface DriverFormData {
  nom: string;
  prenom?: string;
  codeEmploye: string;
  telephone?: string;
  statut: 'ACTIF' | 'INACTIF' | 'EN_CONGE';
}

// Validation function
export function validateSchema<T>(data: T, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {};

  Object.entries(schema).forEach(([key, rules]) => {
    const value = (data as any)[key];

    // Required check
    if (rules.required && (!value || value === '')) {
      errors[key] = `${key} est requis`;
      return;
    }

    // Skip optional fields if empty
    if (!rules.required && (!value || value === '')) {
      return;
    }

    // Min length check
    if (rules.min && String(value).length < rules.min) {
      errors[key] = `${key} doit contenir au moins ${rules.min} caractères`;
    }

    // Max length check
    if (rules.max && String(value).length > rules.max) {
      errors[key] = `${key} ne peut pas dépasser ${rules.max} caractères`;
    }

    // Regex check
    if (rules.regex && !rules.regex.test(String(value))) {
      errors[key] = `${key} format invalide`;
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(String(value))) {
      errors[key] = `${key} valeur invalide`;
    }
  });

  return {
    success: Object.keys(errors).length === 0,
    errors
  };
}

// Helper function to validate driver code uniqueness
export const validateDriverCodeUnique = (
  code: string,
  existingDrivers: Array<{ id?: number; codeEmploye: string }>,
  currentId?: number
): boolean => {
  return !existingDrivers.some(
    driver => driver.codeEmploye === code && driver.id !== currentId
  );
};
