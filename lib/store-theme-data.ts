/**
 * Per-store theme-data resolution (multi-tenant).
 *
 * Ownership split:
 * - The THEME owns settings_schema.json, section schemas, and the
 *   default settings_data/templates/locales — synced from apps/liquid
 *   into lib/theme-data.generated.ts. That module stays the single
 *   source for single-tenant/scaffold apps and for registry stores
 *   without overrides.
 * - A STORE optionally owns stores/<slug>/theme/ (settings_data.json,
 *   templates/*.json, locales/*.json), compiled at build time into
 *   lib/store-theme/ by scripts/generate-store-theme-data.mjs (static
 *   imports keyed by slug — mirrors the store registry pattern).
 *
 * Merge rules (this module, memoized per slug):
 * - settingsData: replaced wholesale (it is a complete document);
 * - templates / customerTemplates / sectionGroups: replaced per name — a
 *   store file supersedes the same-named default, others fall through;
 * - locales: OVERRIDES deep-merged over the theme defaults, so a store
 *   can reword a handful of keys without forking the whole file.
 *
 * Pure module (no react/next imports): shared by the server graph
 * (lib/theme-server.ts, StoreLayout font resolution) and the client
 * graph (lib/theme-setup.ts installs the resolved schema per store).
 */
import type {ThemeSchema} from '@zalify/storefront-kit/react';
import {themeSchema as defaultThemeSchema} from './theme-data.generated';
import {settingsOverride as appSettingsOverride} from './theme-overrides';
import {STORE_THEME_OVERRIDES} from './store-theme/index.generated';

export interface StoreThemeOverrides {
  /** stores/<slug>/theme/settings_data.json — replaces the default. */
  settingsData?: ThemeSchema['settingsData'];
  /** stores/<slug>/theme/templates/*.json — replace per template name. */
  templates?: ThemeSchema['templates'];
  /** stores/<slug>/theme/templates/customers/*.json. */
  customerTemplates?: NonNullable<ThemeSchema['customerTemplates']>;
  /** stores/<slug>/theme/sections/*-group.json — replace per group name. */
  sectionGroups?: ThemeSchema['sectionGroups'];
  /** stores/<slug>/theme/locales/*.json — deep-merged over defaults. */
  locales?: ThemeSchema['locales'];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {...base};
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      isPlainObject(value) && isPlainObject(out[key])
        ? deepMerge(out[key], value)
        : value;
  }
  return out;
}

const schemaCache = new Map<string, ThemeSchema>();

/**
 * The theme schema a store renders with. Unknown slugs (and 'default')
 * resolve to the synced theme defaults — same object identity, so
 * "has this store diverged" checks stay cheap.
 */
export function getThemeSchema(slug: string): ThemeSchema {
  const overrides = STORE_THEME_OVERRIDES[slug];
  if (!overrides) return defaultThemeSchema;
  let merged = schemaCache.get(slug);
  if (!merged) {
    merged = {
      ...defaultThemeSchema,
      ...(overrides.settingsData
        ? {settingsData: overrides.settingsData}
        : null),
      templates: {...defaultThemeSchema.templates, ...overrides.templates},
      customerTemplates: {
        ...defaultThemeSchema.customerTemplates,
        ...overrides.customerTemplates,
      },
      sectionGroups: {
        ...defaultThemeSchema.sectionGroups,
        ...overrides.sectionGroups,
      },
      locales: overrides.locales
        ? (deepMerge(
            defaultThemeSchema.locales,
            overrides.locales,
          ) as ThemeSchema['locales'])
        : defaultThemeSchema.locales,
    };
    schemaCache.set(slug, merged);
  }
  return merged;
}

/**
 * The app-level settings override (lib/theme-overrides.ts) applies only
 * to stores rendering the theme's default settings_data — a store that
 * ships its own settings_data.json owns its settings outright.
 */
export function getSettingsOverride(
  slug: string,
): Record<string, unknown> | undefined {
  return STORE_THEME_OVERRIDES[slug]?.settingsData
    ? undefined
    : appSettingsOverride;
}
