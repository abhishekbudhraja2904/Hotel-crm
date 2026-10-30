// Product name + tagline. Override per deployment with VITE_APP_NAME / VITE_APP_TAGLINE in Vercel.
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || 'Hermora'
export const APP_TAGLINE: string = import.meta.env.VITE_APP_TAGLINE || 'Every relationship, in motion.'
