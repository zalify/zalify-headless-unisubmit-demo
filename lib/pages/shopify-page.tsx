/**
 * Shopify pages body — templates/page.json (and page.contact.json for
 * the contact page, mirroring the theme's alternate template suffix).
 * Shared by app/(default)/pages/[handle] and
 * app/s/[store]/pages/[handle].
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The fetch is wrapped in a per-store unstable_cache, keyed
 * per (slug, handle) with tags 'content' + 'content:<slug>'.
 */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

/** Cached per (store, handle); tag 'content[:<slug>]'. Errors are not cached. */
const queryPage = storeCache('queryPage', queryPageUncached, {
  revalidate: 3600,
  tags: ['content'],
});

async function queryPageUncached(store: StoreConfig, handle: string) {
  const data = await getStorefront(store).query(PAGE_QUERY, {
    variables: {handle},
  });
  return data?.page ?? null;
}

async function loadPage(store: StoreConfig, handle: string) {
  try {
    return await queryPage(store, handle);
  } catch (error: unknown) {
    console.error('[pages] query failed', error);
    return null;
  }
}

export async function shopifyPageMetadata(
  store: StoreConfig,
  handle: string,
): Promise<Metadata> {
  const page = await loadPage(store, handle);
  if (!page) return {};
  return {
    title: page.seo?.title ?? page.title,
    description: page.seo?.description ?? undefined,
  };
}

export async function ShopifyPage({
  store,
  handle,
}: {
  store: StoreConfig;
  handle: string;
}) {
  const page = await loadPage(store, handle);
  if (!page) notFound();

  // Shopify resolves alternate page templates by suffix; the theme
  // ships templates/page.contact.json for the contact page.
  const templateName = handle === 'contact' ? 'page.contact' : 'page';

  return <ThemeTemplateClient name={templateName} resources={{page}} />;
}

const PAGE_QUERY = `#graphql
  query Page($handle: String!) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
