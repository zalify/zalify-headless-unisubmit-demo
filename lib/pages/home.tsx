/**
 * Home page body — templates/index.json through the theme engine, with
 * the per-section server loaders (featured-collection…) run first.
 * Shared by app/(default)/page.tsx and app/s/[store]/page.tsx.
 *
 * The section data comes from the cached loader runner (unstable_cache,
 * tags 'products' + 'products:<slug>', hourly revalidate).
 */
import {loadCachedSectionData} from '~/lib/theme-server';
import type {StoreConfig} from '~/lib/store-config';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export async function HomePage({store}: {store: StoreConfig}) {
  const sectionData = await loadCachedSectionData('index', {}, store);
  return <ThemeTemplateClient name="index" sectionData={sectionData} />;
}
