export function parseDemoMode(value) {
  return value !== "false";
}

export const DEMO_MODE = parseDemoMode(import.meta.env?.VITE_DEMO_MODE);
