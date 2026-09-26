import { z } from 'zod';
import { email, password, personName } from './common.js';

export const registerSchema = z
  .object({
    name: personName,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(128),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export const emailOnlySchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required.'), newPassword: password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });

export const updateProfileSchema = z.object({ name: personName });

export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Password is required.') });
