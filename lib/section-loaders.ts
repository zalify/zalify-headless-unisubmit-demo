/**
 * Server section loaders, keyed by section type — the Next.js registry
 * mirroring installTheme()'s sectionLoaders option.
 *
 * - featured-collection: verbatim port of the builtin loader in
 *   '@zalify/storefront-kit/react/server' (src/registries.server.ts), which server
 *   code can't import in Next (see lib/theme-server.ts).
 * - product-recommendations: port of the Hydrogen app's
 *   app/sections/product-recommendations.server.ts.
 */
import type {SectionLoader} from '@zalify/storefront-kit/react';
import {PRODUCT_CARD_FRAGMENT} from './fragments';

/* ---------------------- featured-collection ---------------------- */

const FEATURED_COLLECTION_QUERY = `#graphql
  query ThemeFeaturedCollection($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      handle
      title
      products(first: $first) {
        nodes {
          ...ProductCard
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

const FIRST_COLLECTIONS_QUERY = `#graphql
  query ThemeFirstCollections($first: Int!) {
    collections(first: 10) {
      nodes {
        id
        handle
        title
        products(first: $first) {
          nodes {
            ...ProductCard
          }
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

const LATEST_PRODUCTS_QUERY = `#graphql
  query ThemeLatestProducts($first: Int!) {
    products(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        ...ProductCard
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

const featuredCollectionLoader: SectionLoader = async ({
  settings,
  storefront,
}) => {
  const first = Number(settings.products_to_show ?? 4) || 4;
  const handle =
    typeof settings.collection === 'string' && settings.collection
      ? settings.collection
      : null;

  if (handle) {
    const data = await storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: {handle, first},
    });
    if (data?.collection) return {collection: data.collection};
  }

  // Fresh-install fallback: first collection that actually has
  // products, then the latest products as a synthetic collection —
  // placeholders only when the store is truly empty.
  const data = await storefront.query(FIRST_COLLECTIONS_QUERY, {
    variables: {first},
  });
  const nonEmpty = (data?.collections?.nodes ?? []).find(
    (node: {products?: {nodes?: unknown[]}}) => node.products?.nodes?.length,
  );
  if (nonEmpty) return {collection: nonEmpty};

  const latest = await storefront.query(LATEST_PRODUCTS_QUERY, {
    variables: {first},
  });
  const products = latest?.products?.nodes ?? [];
  if (!products.length) return {collection: null};
  return {
    collection: {
      id: 'latest',
      handle: 'all',
      title: 'Featured products',
      products: {nodes: products},
    },
  };
};

/* -------------------- product-recommendations -------------------- */

const RECOMMENDATIONS_QUERY = `#graphql
  query ThemeProductRecommendations(
    $handle: String!
    $intent: ProductRecommendationIntent
  ) {
    productRecommendations(productHandle: $handle, intent: $intent) {
      ...ProductCard
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

const productRecommendationsLoader: SectionLoader = async ({
  settings,
  params,
  storefront,
}) => {
  const handle = params.handle;
  if (!handle) return {products: []};

  const intent =
    settings.intent === 'complementary' ? 'COMPLEMENTARY' : 'RELATED';
  const limit = Number(settings.products_to_show ?? 4) || 4;

  const data = await storefront.query(RECOMMENDATIONS_QUERY, {
    variables: {handle, intent},
  });

  return {
    products: ((data?.productRecommendations ?? []) as unknown[]).slice(
      0,
      limit,
    ),
  };
};

export const sectionLoaders: Record<string, SectionLoader> = {
  'featured-collection': featuredCollectionLoader,
  'product-recommendations': productRecommendationsLoader,
};
