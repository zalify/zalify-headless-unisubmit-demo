/**
 * /collections/all body — Shopify's synthetic "all" collection: the
 * whole catalog rendered through the theme's collection template.
 * Shared by app/(default)/collections/all and
 * app/s/[store]/collections/all.
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The catalog fetch is wrapped in a per-store
 * unstable_cache, keyed by (slug, sort, cursor) with tags 'products' +
 * 'products:<slug>'.
 */
import {parseSort} from '@zalify/storefront-kit/commerce';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {loadCachedSectionData} from '~/lib/theme-server';
import {getPaginationVariables, type PaginationVariables} from '~/lib/pagination';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';
import type {RawSearchParams} from './product';

/** Cached per (store, sort, cursor); tag 'products[:<slug>]'. Errors are not cached. */
const queryCatalog = storeCache('queryCatalog', queryCatalogUncached, {
  revalidate: 3600,
  tags: ['products'],
});

async function queryCatalogUncached(
  store: StoreConfig,
  sortKey: string,
  reverse: boolean,
  paginationVariables: PaginationVariables,
) {
  return getStorefront(store).query(CATALOG_QUERY, {
    variables: {...paginationVariables, sortKey, reverse},
  });
}

export async function CatalogPage({
  store,
  searchParams,
}: {
  store: StoreConfig;
  searchParams: RawSearchParams;
}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.append(name, value);
  }
  const paginationVariables = getPaginationVariables(params, 24);
  const {sortKey, reverse} = parseSort(params);

  const [data, sectionData] = await Promise.all([
    queryCatalog(
      store,
      // /collections/all sorts with product sort keys, not collection ones
      sortKey === 'MANUAL' ? 'RELEVANCE' : sortKey,
      reverse,
      paginationVariables,
    ).catch((error: unknown) => {
      console.error('[collections/all] query failed', error);
      return null;
    }),
    loadCachedSectionData('collection', {}, store),
  ]);

  // Mirror of Shopify's synthetic "all" collection: the theme's
  // collection template renders it like any other collection.
  const collection = {
    id: 'all',
    handle: 'all',
    title: 'All products',
    description: '',
    descriptionHtml: '',
    image: null,
    products: data?.products ?? {nodes: [], pageInfo: {}},
  };

  return (
    <ThemeTemplateClient
      name="collection"
      resources={{collection}}
      sectionData={sectionData}
    />
  );
}

const CATALOG_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query CatalogAll(
    $sortKey: ProductSortKeys!
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) {
    products(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      sortKey: $sortKey,
      reverse: $reverse
    ) {
      nodes {
        ...ProductCard
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        endCursor
        startCursor
      }
    }
  }
` as const;
