// The version this copy of the app runs, set by the build on GitHub for every
// push (1.0.<run number>) and carried by over-the-air updates too, so it
// always matches the GitHub release of the same name. Local builds say "dev".
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || 'dev';
export const COMMIT = (process.env.EXPO_PUBLIC_COMMIT || '').slice(0, 7);
const BUILD_DATE = process.env.EXPO_PUBLIC_BUILD_DATE || '';

// "Version 1.0.57, updated 12 Nov 2026"
export function versionLine(): string {
  const d = BUILD_DATE ? new Date(BUILD_DATE) : null;
  const date = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return `Version ${APP_VERSION}${date ? `, updated ${date}` : ''}`;
}

export const releaseUrl = () => (APP_VERSION === 'dev' ? null : `https://github.com/Darkshadowgame/caristini-app/releases/tag/v${APP_VERSION}`);
