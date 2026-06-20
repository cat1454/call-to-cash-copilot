export function parseDemoMode(value) {
  return value !== "false";
}

export const DEMO_MODE = parseDemoMode(import.meta.env?.VITE_DEMO_MODE);

/**
 * Base URL for the Call-to-Cash API.
 * Set VITE_API_BASE_URL in .env to enable API mode.
 * When null, the web app runs in pure mock simulation mode.
 *
 * @type {string | null}
 */
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL?.trim() || null;
