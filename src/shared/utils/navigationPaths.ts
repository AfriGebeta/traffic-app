const NAVIGATION_PATHS = [
  '/navigation/route-preview',
  '/taxi/navigation',
  '/taxi/route-preview',
  '/free-drive',
];

export const isNavigationPath = (path: string) => NAVIGATION_PATHS.some((p) => path.startsWith(p));
