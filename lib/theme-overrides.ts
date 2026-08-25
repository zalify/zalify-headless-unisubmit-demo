/**
 * App-level theme settings override, shared by the client graph
 * (lib/theme-setup.ts installTheme) and the server layout (font
 * resolution) — server components cannot read installTheme()'s store,
 * so anything both sides need lives here. No react imports.
 */
export const settingsOverride = {
  // This storefront deliberately diverges from the synced theme preset:
  // Cabin (Google Fonts) instead of the theme's Work Sans.
  type_body_google: 'Cabin',
  type_heading_google: 'Cabin',
};
