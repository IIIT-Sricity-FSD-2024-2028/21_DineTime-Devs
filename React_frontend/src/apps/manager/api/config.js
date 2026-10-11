const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').trim();

// The client never guesses a backend address. Each environment must supply the
// URL explicitly through Vite's environment configuration.
export const API_BASE = configuredApiBase ? configuredApiBase.replace(/\/$/, '') : '';

export function requireApiBase() {
  if (!API_BASE) {
    throw new Error('VITE_API_BASE_URL is not configured. Add it to your .env file.');
  }
  return API_BASE;
}
