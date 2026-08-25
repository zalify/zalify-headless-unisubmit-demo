/**
 * /collections body — templates/list-collections.json (the
 * 'collections' section renders the card grid from the connection).
 * Shared by app/(default)/collections and app/s/[store]/collections.
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The fetch is wrapped in a per-store unstable_cache, keyed
 * per (slug, cursor) with tags 'collections' + 'collections:<slug>'.
 */
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {getPaginationVariables, type PaginationVariables} from '~/lib/pagination';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';
import type {RawSearchParams} from './product';

/** Cached per (store, cursor); tag 'collections[:<slug>]'. Errors are not cached. */
const queryCollections = storeCache('queryCollections', queryCollectionsUncached, {
  revalidate: 3600,
  tags: ['collections'],
});

async function queryCollectionsUncached(
  store: StoreConfig,
  paginationVariables: PaginationVariables,
) {
  return getStorefront(store).query(COLLECTIONS_QUERY, {
    variables: {...paginationVariables},
  });
}

export async function CollectionsIndexPage({
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

  const data = await queryCollections(store, paginationVariables).catch(
    (error: unknown) => {
      console.error('[collections] query failed', error);
      return null;
    },
  );

  return (
    <ThemeTemplateClient
      name="list-collections"
      resources={{collections: data?.collections ?? {nodes: [], pageInfo: {}}}}
    />
  );
}

const COLLECTIONS_QUERY = `#graphql
  fragment CollectionCard on Collection {
    id
    title
    handle
    image {
      id
      url
      altText
      width
      height
    }
  }
  query StoreCollections(
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) {
    collections(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...CollectionCard
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
` as const;
