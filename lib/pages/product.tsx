/**
 * Product page body — templates/product.json. The URL selects the
 * variant, canonically `?variant=<numeric id>` (the Liquid store /
 * ProductCard deep-link format; legacy `OptionName=Value` pairs still
 * resolve). The variant is resolved locally from the product's variants
 * list — server-side here for the initial render, and client-side per
 * render for instant switches (useSelectedVariant +
 * history.replaceState). Shared by app/(default)/products/[handle] and
 * app/s/[store]/products/[handle].
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The storefront fetch is wrapped in a per-store
 * unstable_cache, keyed by (slug, handle) with tags 'products' +
 * 'products:<slug>' — one cache entry per product per store, shared
 * across every variant selection.
 */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {loadCachedSectionData} from '~/lib/theme-server';
import {selectedVariantFromParams} from '~/lib/product-options';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export type RawSearchParams = Record<string, string | string[] | undefined>;

function toURLSearchParams(searchParams: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.set(name, value);
  }
  return params;
}

/** Cached per (store, handle); invalidated via tag 'products[:<slug>]'.
    Thrown errors are NOT cached — the catch lives at the call sites. */
const queryProduct = storeCache('queryProduct', queryProductUncached, {
  revalidate: 3600,
  tags: ['products'],
});

async function queryProductUncached(store: StoreConfig, handle: string) {
  const data = await getStorefront(store).query(PRODUCT_QUERY, {
    variables: {handle},
  });
  return data?.product ?? null;
}

async function loadProduct(store: StoreConfig, handle: string) {
  try {
    return await queryProduct(store, handle);
  } catch (error: unknown) {
    console.error('[products] query failed', error);
    return null;
  }
}

export async function productMetadata(
  store: StoreConfig,
  handle: string,
): Promise<Metadata> {
  const product = await loadProduct(store, handle);
  if (!product) return {};
  return {
    title: product.seo?.title ?? product.title,
    description: product.seo?.description ?? product.description ?? undefined,
    alternates: {canonical: `/products/${product.handle}`},
  };
}

export async function ProductPage({
  store,
  handle,
  searchParams,
}: {
  store: StoreConfig;
  handle: string;
  searchParams: RawSearchParams;
}) {
  const urlParams = toURLSearchParams(searchParams);

  const [product, sectionData] = await Promise.all([
    loadProduct(store, handle),
    loadCachedSectionData('product', {handle}, store),
  ]);

  if (!product?.id) notFound();

  // Server-side mirror of useSelectedVariant: resolve ?variant (or
  // legacy option pairs) against the cached product's variants so the
  // initial HTML shows the deep-linked variant.
  const selectedVariant = selectedVariantFromParams(product, urlParams);

  return (
    <ThemeTemplateClient
      name="product"
      resources={{
        product,
        selectedVariant,
      }}
      sectionData={sectionData}
    />
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
    unitPriceMeasurement {
      referenceValue
      referenceUnit
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    tags
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage {
      id
      url
      altText
      width
      height
    }
    media(first: 250) {
      nodes {
        __typename
        id
        alt
        mediaContentType
        previewImage {
          id
          url
          altText
          width
          height
        }
        ... on MediaImage {
          image {
            id
            url
          }
        }
        ... on Video {
          sources {
            url
            mimeType
            format
            height
          }
        }
        ... on ExternalVideo {
          embedUrl
        }
        ... on Model3d {
          sources {
            url
            mimeType
          }
        }
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: [], ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants(selectedOptions: []) {
      ...ProductVariant
    }
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
