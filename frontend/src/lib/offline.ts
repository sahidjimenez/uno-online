// Use bots in development and hosted multiplayer in production by default.
export const OFFLINE_MODE = import.meta.env.VITE_OFFLINE_MODE === undefined
  ? import.meta.env.DEV
  : import.meta.env.VITE_OFFLINE_MODE === 'true'
