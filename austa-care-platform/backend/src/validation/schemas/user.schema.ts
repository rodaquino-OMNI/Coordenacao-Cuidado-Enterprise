import { z } from 'zod';

/**
 * Brazilian CPF validation
 */
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const cpfValidator = (cpf: string): boolean => {
  // Remove formatting
  const cleanCpf = cpf.replace(/[^\d]/g, '');

  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false; // All same digits

  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let checkDigit = 11 - (sum % 11);
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0;
  if (checkDigit !== parseInt(cleanCpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  checkDigit = 11 - (sum % 11);
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0;
  if (checkDigit !== parseInt(cleanCpf.charAt(10))) return false;

  return true;
};

/**
 * Brazilian phone number validation
 */
const phoneRegex = /^\+55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

/**
 * Brazilian CEP (postal code) validation
 */
const cepRegex = /^\d{5}-\d{3}$/;

/**
 * User role enum
 */
export const UserRoleSchema = z.enum([
  'PATIENT',
  'CAREGIVER',
  'FAMILY_MEMBER',
  'HEALTHCARE_PROFESSIONAL',
  'ADMIN'
]);

/**
 * User registration schema
 */
export const createUserSchema = z.object({
  body: z.object({
    email: z.string()
      .email({ message: 'Email inválido' })
      .toLowerCase()
      .trim(),

    password: z.string()
      .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
      .regex(/[A-Z]/, { message: 'Senha deve conter ao menos uma letra maiúscula' })
      .regex(/[a-z]/, { message: 'Senha deve conter ao menos uma letra minúscula' })
      .regex(/[0-9]/, { message: 'Senha deve conter ao menos um número' })
      .regex(/[^A-Za-z0-9]/, { message: 'Senha deve conter ao menos um caractere especial' }),

    name: z.string()
      .min(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
      .max(100, { message: 'Nome deve ter no máximo 100 caracteres' })
      .trim(),

    cpf: z.string()
      .regex(cpfRegex, { message: 'CPF inválido. Use o formato: 000.000.000-00' })
      .refine(cpfValidator, { message: 'CPF inválido' }),

    phone: z.string()
      .regex(phoneRegex, { message: 'Telefone inválido. Use o formato: +55 (00) 00000-0000' })
      .optional(),

    dateOfBirth: z.string()
      .datetime({ message: 'Data de nascimento inválida' })
      .optional()
      .transform((val) => val ? new Date(val) : undefined),

    role: UserRoleSchema.default('PATIENT'),

    address: z.object({
      street: z.string().min(1, { message: 'Rua é obrigatória' }).optional(),
      number: z.string().min(1, { message: 'Número é obrigatório' }).optional(),
      complement: z.string().optional(),
      neighborhood: z.string().min(1, { message: 'Bairro é obrigatório' }).optional(),
      city: z.string().min(1, { message: 'Cidade é obrigatória' }).optional(),
      state: z.string()
        .length(2, { message: 'Estado deve ter 2 caracteres (ex: SP)' })
        .toUpperCase()
        .optional(),
      cep: z.string()
        .regex(cepRegex, { message: 'CEP inválido. Use o formato: 00000-000' })
        .optional(),
    }).optional(),

    emergencyContact: z.object({
      name: z.string().min(1, { message: 'Nome do contato de emergência é obrigatório' }),
      phone: z.string().regex(phoneRegex, { message: 'Telefone inválido' }),
      relationship: z.string().min(1, { message: 'Relação é obrigatória' }),
    }).optional(),

    healthProfile: z.object({
      bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
      allergies: z.array(z.string()).optional(),
      chronicConditions: z.array(z.string()).optional(),
      currentMedications: z.array(z.string()).optional(),
    }).optional(),
  }),
});

/**
 * User update schema (all fields optional)
 */
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),

  body: z.object({
    name: z.string()
      .min(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
      .max(100, { message: 'Nome deve ter no máximo 100 caracteres' })
      .trim()
      .optional(),

    phone: z.string()
      .regex(phoneRegex, { message: 'Telefone inválido' })
      .optional(),

    dateOfBirth: z.string()
      .datetime({ message: 'Data de nascimento inválida' })
      .transform((val) => new Date(val))
      .optional(),

    address: z.object({
      street: z.string().optional(),
      number: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).toUpperCase().optional(),
      cep: z.string().regex(cepRegex).optional(),
    }).optional(),

    emergencyContact: z.object({
      name: z.string(),
      phone: z.string().regex(phoneRegex),
      relationship: z.string(),
    }).optional(),

    healthProfile: z.object({
      bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
      allergies: z.array(z.string()).optional(),
      chronicConditions: z.array(z.string()).optional(),
      currentMedications: z.array(z.string()).optional(),
    }).optional(),

    preferences: z.object({
      language: z.enum(['pt-BR', 'en-US']).optional(),
      notifications: z.boolean().optional(),
      theme: z.enum(['light', 'dark', 'auto']).optional(),
    }).optional(),
  }),
});

/**
 * User login schema
 */
export const loginUserSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Email inválido' }).toLowerCase(),
    password: z.string().min(1, { message: 'Senha é obrigatória' }),
  }),
});

/**
 * Password reset request schema
 */
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Email inválido' }).toLowerCase(),
  }),
});

/**
 * Password reset schema
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Token é obrigatório' }),
    newPassword: z.string()
      .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
      .regex(/[A-Z]/, { message: 'Senha deve conter ao menos uma letra maiúscula' })
      .regex(/[a-z]/, { message: 'Senha deve conter ao menos uma letra minúscula' })
      .regex(/[0-9]/, { message: 'Senha deve conter ao menos um número' })
      .regex(/[^A-Za-z0-9]/, { message: 'Senha deve conter ao menos um caractere especial' }),
  }),
});

/**
 * Get user by ID schema
 */
export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),
});

/**
 * Delete user schema
 */
export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
  }),
});

/**
 * List users schema (query parameters)
 */
export const listUsersSchema = z.object({
  query: z.object({
    page: z.string()
      .regex(/^\d+$/, { message: 'Página deve ser um número' })
      .transform(Number)
      .default('1'),

    limit: z.string()
      .regex(/^\d+$/, { message: 'Limite deve ser um número' })
      .transform(Number)
      .default('10')
      .refine((val) => val <= 100, { message: 'Limite máximo é 100' }),

    role: UserRoleSchema.optional(),

    search: z.string().optional(),
  }).optional(),
});

// Export types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
