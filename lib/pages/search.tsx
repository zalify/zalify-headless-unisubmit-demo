/**
 * /search body — templates/search.json with the Storefront search query
 * (products + pages + articles), productFilters from the facets URL
 * contract, sort, and cursor pagination. Shared by
 * app/(default)/search and app/s/[store]/search.
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The search fetch is wrapped in a per-store unstable_cache,
 * keyed by (slug, term, filters, sort, cursor) with tags 'products' +
 * 'products:<slug>', so repeated queries serve from the data cache.
 */
import {parseFilters, parseSearchSort} from '@zalify/storefront-kit/commerce';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {getPaginationVariables, type PaginationVariables} from '~/lib/pagination';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';
import type {RawSearchParams} from './product';

/** Cached per (store, term, filters, sort, cursor); tag 'products[:<slug>]'. */
const querySearch = storeCache('querySearch', querySearchUncached, {
  revalidate: 3600,
  tags: ['products'],
});

async function querySearchUncached(
  store: StoreConfig,
  term: string,
  filters: unknown[],
  sortKey: string | undefined,
  reverse: boolean,
  paginationVariables: PaginationVariables,
) {
  return getStorefront(store).query(SEARCH_QUERY, {
    variables: {term, filters, sortKey, reverse, ...paginationVariables},
  });
}

export async function SearchPage({
  store,
  searchParams,
}: {
  store: StoreConfig;
  searchParams: RawSearchParams;
}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.append(name, value);
    else if (Array.isArray(value)) for (const v of value) params.append(name, v);
  }
  const term = (params.get('q') ?? '').trim();

  let searchResult: {
    type: 'regular';
    term: string;
    error?: string;
    result: {total: number; items: Record<string, unknown>} | null;
  } = {type: 'regular', term, result: null};

  if (term) {
    const paginationVariables = getPaginationVariables(params, 24);
    const filters = parseFilters(params);
    const {sortKey, reverse} = parseSearchSort(params);
    const data = await querySearch(
      store,
      term,
      filters,
      sortKey,
      reverse,
      paginationVariables,
    ).catch((error: unknown) => {
      console.error('[search] query failed', error);
      return null;
    });

    if (data) {
      const items = {
        articles: data.articles ?? {nodes: []},
        pages: data.pages ?? {nodes: []},
        // The section reads products.filters — alias productFilters.
        products: data.products
          ? {...data.products, filters: data.products.productFilters ?? []}
          : {nodes: [], pageInfo: {}},
      };
      const total = Object.values(items).reduce(
        (sum: number, connection: any) =>
          sum + (connection?.nodes?.length ?? 0),
        0,
      );
      searchResult = {type: 'regular', term, result: {total, items}};
    } else {
      searchResult = {
        type: 'regular',
        term,
        error: 'Search failed',
        result: {total: 0, items: {}},
      };
    }
  }

  return <ThemeTemplateClient name="search" resources={{searchResult}} />;
}

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
    __typename
    handle
    id
    title
    trackingParameters
  }
` as const;

const SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment SearchArticle on Article {
    __typename
    handle
    id
    title
    trackingParameters
    blog {
      handle
    }
  }
` as const;

const PAGE_INFO_FRAGMENT = `#graphql
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
` as const;

const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $term: String!
    $filters: [ProductFilter!]
    $sortKey: SearchSortKeys
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) {
    articles: search(
      query: $term,
      types: [ARTICLE],
      first: $first,
    ) {
      nodes {
        ...on Article {
          ...SearchArticle
        }
      }
    }
    pages: search(
      query: $term,
      types: [PAGE],
      first: $first,
    ) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      productFilters: $filters,
      sortKey: $sortKey,
      reverse: $reverse,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
      nodes {
        ...on Product {
          ...ProductCard
          trackingParameters
        }
      }
      productFilters {
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
        ...PageInfoFragment
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${SEARCH_ARTICLE_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
` as const;
