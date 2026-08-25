/**
 * Collection page body — templates/collection.json with the facets URL
 * contract (sort_by=<handle>, filter.<key>=<json>) parsed through
 * @zalify/storefront-kit/commerce and cursor pagination (cursor + direction).
 * Shared by app/(default)/collections/[handle] and
 * app/s/[store]/collections/[handle].
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The storefront fetch is wrapped in a per-store
 * unstable_cache, keyed by (slug, handle, filters, sort, cursor) with
 * tags 'collections' + 'collections:<slug>'.
 */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {parseFilters, parseSort} from '@zalify/storefront-kit/commerce';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {loadCachedSectionData} from '~/lib/theme-server';
import {getPaginationVariables, type PaginationVariables} from '~/lib/pagination';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';
import type {RawSearchParams} from './product';

function toURLSearchParams(searchParams: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.append(name, value);
    else if (Array.isArray(value)) for (const v of value) params.append(name, v);
  }
  return params;
}

/** Cached per (store, handle, filters, sort, cursor); tag 'collections[:<slug>]'.
    Thrown errors are NOT cached — the catch lives at the call site. */
const queryCollection = storeCache('queryCollection', queryCollectionUncached, {
  revalidate: 3600,
  tags: ['collections'],
});

async function queryCollectionUncached(
  store: StoreConfig,
  handle: string,
  filters: unknown[],
  sortKey: string,
  reverse: boolean,
  paginationVariables: PaginationVariables,
) {
  const data = await getStorefront(store).query(COLLECTION_QUERY, {
    variables: {handle, filters, sortKey, reverse, ...paginationVariables},
  });
  return data?.collection ?? null;
}

async function loadCollection(
  store: StoreConfig,
  handle: string,
  searchParams: RawSearchParams,
) {
  const params = toURLSearchParams(searchParams);
  const paginationVariables = getPaginationVariables(params, 24);
  const filters = parseFilters(params);
  const {sortKey, reverse} = parseSort(params);

  try {
    return await queryCollection(
      store,
      handle,
      filters,
      sortKey,
      reverse,
      paginationVariables,
    );
  } catch (error: unknown) {
    console.error('[collections] query failed', error);
    return null;
  }
}

export function collectionMetadata(handle: string): Metadata {
  return {title: `${handle.replace(/-/g, ' ')} Collection`};
}

export async function CollectionPage({
  store,
  handle,
  searchParams,
}: {
  store: StoreConfig;
  handle: string;
  searchParams: RawSearchParams;
}) {
  const [collection, sectionData] = await Promise.all([
    loadCollection(store, handle, searchParams),
    loadCachedSectionData('collection', {handle}, store),
  ]);

  if (!collection) notFound();

  return (
    <ThemeTemplateClient
      name="collection"
      resources={{collection}}
      sectionData={sectionData}
    />
  );
}

const COLLECTION_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query Collection(
    $handle: String!
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys!
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      descriptionHtml
      image {
        url
        altText
        width
        height
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        nodes {
          ...ProductCard
        }
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
