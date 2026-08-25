/**
 * GET /api/predictive-search?q=…&limit=…
 *
 * The Next stand-in for Hydrogen's /search?predictive fetcher (and the
 * Liquid theme's Predictive Search API + Section Rendering): runs the
 * Storefront `predictiveSearch` query (ported from the Hydrogen
 * mirror's search route) and returns
 * `{type, term, result: {total, items}}` — the same envelope Hydrogen's
 * predictiveSearch() resolves with, so the drawer's consumption stays
 * comparable across mirrors.
 *
 * Consumed by components/sections/predictive-search.tsx (250ms
 * debounced). Degrades to empty items when the backing store doesn't
 * implement predictiveSearch (e.g. mock.shop) instead of erroring.
 */
import {NextResponse, type NextRequest} from 'next/server';
import {getStorefront} from '~/lib/storefront';
import {getRequestStore} from '~/lib/store-config';

const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
    featuredImage {
      url
      altText
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

function emptyItems() {
  return {
    articles: [],
    collections: [],
    pages: [],
    products: [],
    queries: [],
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const term = String(params.get('q') ?? '').trim();
  const limit = Math.min(24, Math.max(1, Number(params.get('limit')) || 10));

  if (!term) {
    return NextResponse.json({
      type: 'predictive',
      term,
      result: {total: 0, items: emptyItems()},
    });
  }

  try {
    // Multi-tenant: /api is excluded from the middleware rewrite, so
    // the store is resolved from the Host header here (falls back to
    // the env-configured store when no registry host matches).
    const storefront = getStorefront(
      getRequestStore(request.headers.get('host')),
    );
    const data = await storefront.query(PREDICTIVE_SEARCH_QUERY, {
      variables: {limit, limitScope: 'EACH', term},
    });
    const items = data?.predictiveSearch ?? emptyItems();
    const total = Object.values(items).reduce(
      (acc: number, item) => acc + (Array.isArray(item) ? item.length : 0),
      0,
    );
    return NextResponse.json({type: 'predictive', term, result: {total, items}});
  } catch (error) {
    // Stores without predictiveSearch (e.g. mock.shop) degrade to an
    // empty result — the drawer shows "no results" instead of erroring.
    // eslint-disable-next-line no-console
    console.error('[predictive-search] query failed', error);
    return NextResponse.json({
      type: 'predictive',
      term,
      error: error instanceof Error ? error.message : 'Predictive search failed',
      result: {total: 0, items: emptyItems()},
    });
  }
}
