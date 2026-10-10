// Who runs the game and how to reach them, for the privacy policy and terms (src/app/privacy,
// src/app/terms). Set NEXT_PUBLIC_CONTACT_EMAIL at build time to the address players should write to.

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@hexhordes.com';
export const SITE_URL = 'https://hexhordes.com';

// Shown at the top of both pages: change it whenever either is changed
export const LEGAL_UPDATED = '10 October 2026';
