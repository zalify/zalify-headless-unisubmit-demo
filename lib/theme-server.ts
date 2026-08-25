/**
 * Server side of the theme engine for Next.js.
 *
 * This is a local mirror of '@zalify/storefront-kit/react/server' (getTemplate /
 * getSectionGroup / loadSectionData): Next resolves `react` with the
 * `react-server` condition inside the server-component graph, where
 * client hooks don't exist — and both '@zalify/storefront-kit/react' entry points
 * transitively import hook-using components (ProductCard, Facets…), so
 * server code cannot import the package at all. Only types are imported
 * (erased at compile time); the ~50-line loader runner is duplicated
 * here, reading the schema from the sync-generated module instead of
 * the installTheme() store.
 *
 * installTheme() itself runs only in the client-module graph
 * (lib/theme-setup.ts) — which Next also evaluates during SSR, so
 * <ThemeTemplate>/<SectionGroup> render fine server-side as client
 * components.
 */
import type {
  SectionGroupData,
  SectionLoader,
  SectionLoaderArgs,
  TemplateData,
} from '@zalify/storefront-kit/react';
import {sectionLoaders} from './section-loaders';
import {getStorefront, type Storefront} from './storefront';
import {
  DEFAULT_STORE_SLUG,
  defaultStoreConfig,
  type StoreConfig,
} from './store-config';
import {storeCache} from './store-cache';
import {getThemeSchema} from './store-theme-data';

/**
 * Look up a page template ("index", "product", "page.contact"…) —
 * store-owned template overrides (stores/<slug>/theme/templates/)
 * resolve by slug; the default slug serves the theme's own templates.
 */
export function getTemplate(
  name: string,
  slug: string = DEFAULT_STORE_SLUG,
): TemplateData {
  const themeSchema = getThemeSchema(slug);
  const template = name.startsWith('customers/')
    ? themeSchema.customerTemplates?.[name.slice('customers/'.length)]
    : themeSchema.templates[name];
  if (!template) throw new Error(`Unknown theme template: ${name}`);
  return template;
}

/** Look up a section group ("header-group", "footer-group", "overlay-group"). */
export function getSectionGroup(
  name: string,
  slug: string = DEFAULT_STORE_SLUG,
): SectionGroupData {
  const group = getThemeSchema(slug).sectionGroups[name];
  if (!group) throw new Error(`Unknown theme section group: ${name}`);
  return group;
}

export interface LoaderContext {
  storefront: Storefront;
  params: Record<string, string | undefined>;
  request: Request;
}

async function runLoaders(
  template: TemplateData,
  context: LoaderContext,
): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    template.order.map(async (sectionId) => {
      const section = template.sections[sectionId];
      if (!section || section.disabled) return null;
      const loader: SectionLoader | undefined = sectionLoaders[section.type];
      if (!loader) return null;
      try {
        const data = await loader({
          ...context,
          settings: section.settings ?? {},
          section,
          sectionId,
        } as SectionLoaderArgs);
        return [sectionId, data] as const;
      } catch (error) {
        // A failing section must not take down the page.
        // eslint-disable-next-line no-console
        console.error(`[theme] loader for section "${sectionId}" failed`, error);
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter(Boolean) as [string, unknown][]);
}

/** Run all section loaders for a page template. */
export async function loadSectionData(
  templateName: string,
  context: LoaderContext,
  slug: string = DEFAULT_STORE_SLUG,
): Promise<Record<string, unknown>> {
  return runLoaders(getTemplate(templateName, slug), context);
}

/** Run all section loaders for a section group (header/footer/overlay). */
export async function loadGroupSectionData(
  groupName: string,
  context: LoaderContext,
  slug: string = DEFAULT_STORE_SLUG,
): Promise<Record<string, unknown>> {
  return runLoaders(getSectionGroup(groupName, slug), context);
}

/**
 * Cached section-loader runner (unstable_cache via storeCache) — keyed
 * by store slug + template name + route params. Every registered loader
 * (featured-collection, product-recommendations) fetches product lists,
 * so the entries carry the 'products' + 'products:<slug>' tags and
 * revalidate hourly. Only serializable args may cross this boundary;
 * the storefront client and the placeholder Request are constructed
 * inside. `store` defaults to the env-configured single-tenant store.
 */
const cachedSectionData = storeCache(
  'loadCachedSectionData',
  loadCachedSectionDataUncached,
  // 'settings' + scoped 'settings:<slug>' cover the template/settings
  // JSON compiled into these entries — a future editor publish for one
  // store revalidates tag `settings:<slug>` without touching the rest.
  {revalidate: 3600, tags: ['products', 'settings']},
);

export function loadCachedSectionData(
  templateName: string,
  params: Record<string, string | undefined> = {},
  store: StoreConfig = defaultStoreConfig,
): Promise<Record<string, unknown>> {
  return cachedSectionData(store, templateName, params);
}

async function loadCachedSectionDataUncached(
  store: StoreConfig,
  templateName: string,
  params: Record<string, string | undefined>,
): Promise<Record<string, unknown>> {
  return loadSectionData(
    templateName,
    {
      storefront: getStorefront(store),
      params,
      request: new Request('http://localhost/'),
    },
    store.slug,
  );
}
