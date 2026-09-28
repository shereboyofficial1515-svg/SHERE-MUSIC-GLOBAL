import { adminDocs, helpDocs } from '../../services/docsService.js';

/** What differs between the public Help Center and the private Admin Guide. */
export const HELP = {
  kind: 'help',
  private: false,
  base: '/help',
  api: helpDocs,
  label: 'SHERE MUSIC Help',
  brandLabel: 'HELP',
  homeLabel: 'Help Center',
  searchPlaceholder: 'Search SHERE MUSIC Help',
  metaDescription: 'Answers about listening, lyrics, SHERE MUSIC Plus, uploading music as an artist, music videos and your account.',
  backTo: '/',
  backLabel: 'SHERE MUSIC',
  // Public footer: never links to anything administrative.
  footerLinks: [
    ['Help', '/help'],
    ['Terms', '/help/legal/terms-of-service'],
    ['Privacy', '/help/legal/privacy-policy'],
    ['Copyright', '/help/legal/copyright-policy'],
    ['Contact', '/help/troubleshooting/contact-support'],
  ],
};

export const ADMIN_GUIDE = {
  kind: 'admin',
  private: true,
  base: '/admin/docs',
  api: adminDocs,
  label: 'Admin Guide',
  brandLabel: 'ADMIN GUIDE',
  homeLabel: 'Admin Guide',
  searchPlaceholder: 'Search the Admin Guide',
  metaDescription: '',
  backTo: '/admin',
  backLabel: 'Admin dashboard',
  footerLinks: [
    ['Admin Guide', '/admin/docs'],
    ['Admin dashboard', '/admin'],
    ['Help Center', '/help'],
  ],
};
