import { api } from './api.js';

export const authService = {
  me: () => api.get('/auth/me'),
  register: (body) => api.post('/auth/register', body),
  login: (body) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  changePassword: (body) => api.post('/auth/change-password', body),
};
