export const appName = "Revive ST";

/**
 * Open Graph fields every page shares. A page that sets `openGraph` replaces
 * its parent's whole object, so it spreads these back in.
 */
export const siteOpenGraph = { siteName: appName, type: "website" } as const;

export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const docsContentRoute = "/llms.mdx/docs";

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: "pradel",
  repo: "revive-st",
  branch: "main",
};
