/**
 * Minimal Shopify Storefront API client (plain fetch) — the Next.js
 * mirror of Hydrogen's `context.storefront`. Its shape satisfies
 * ui-react's SectionLoaderArgs.storefront ({query}), so shared section
 * loaders run unchanged.
 *
 * Two ways to get a client:
 * - `storefront` — the classic env-configured singleton
 *   (NEXT_PUBLIC_STORE_DOMAIN / NEXT_PUBLIC_STOREFRONT_API_TOKEN;
 *   unset → https://mock.shop/api so the template runs out of the box).
 * - `getStorefront(storeConfig)` — per-store factory for the
 *   multi-tenant /s/[store] routes (config from the generated store
 *   registry). Clients are memoized per domain+token.
 */
import {
  defaultStoreConfig,
  publicDomainOf,
  type StoreConfig,
} from './store-config';

const API_VERSION = '2025-01';

export const usingMockShop = !defaultStoreConfig.storeDomain;

/** Public domain of the env-configured store (single-tenant mode). */
export const publicStoreDomain = publicDomainOf(defaultStoreConfig);

export interface StorefrontQueryOptions {
  variables?: Record<string, unknown>;
  /** Accepted for parity with Hydrogen loaders; unused (no cache API). */
  cache?: unknown;
  [key: string]: unknown;
}

export interface Storefront {
  query: (query: string, options?: StorefrontQueryOptions) => Promise<any>;
}

function createStorefront(domain: string, token: string): Storefront {
  const endpoint = domain
    ? `https://${domain}/api/${API_VERSION}/graphql.json`
    : 'https://mock.shop/api';

  /**
   * Run a Storefront API query. Resolves with the `data` payload;
   * GraphQL errors reject with the first error message (mirroring
   * Hydrogen's storefront.query contract loosely — callers wrap the
   * calls they want to degrade gracefully).
   */
  async function query(
    queryString: string,
    options: StorefrontQueryOptions = {},
  ): Promise<any> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {'X-Shopify-Storefront-Access-Token': token} : {}),
      },
      body: JSON.stringify({
        query: queryString,
        variables: options.variables ?? {},
      }),
      // No explicit cache option: a plain fetch is uncached by default
      // (Next 15+), and callers opt whole functions into the data cache
      // with unstable_cache.
    });

    if (!response.ok) {
      throw new Error(
        `[storefront] ${response.status} ${response.statusText} from ${endpoint}`,
      );
    }

    const json = (await response.json()) as {
      data?: unknown;
      errors?: Array<{message?: string}>;
    };

    if (json.errors?.length && json.data == null) {
      throw new Error(
        `[storefront] ${json.errors.map((e) => e.message).join('; ')}`,
      );
    }

    return json.data;
  }

  return {query};
}

const clients = new Map<string, Storefront>();

/** Per-store client, memoized; no config → the env-configured store. */
export function getStorefront(store: StoreConfig = defaultStoreConfig): Storefront {
  const key = `${store.storeDomain}|${store.storefrontToken}`;
  let client = clients.get(key);
  if (!client) {
    client = createStorefront(store.storeDomain, store.storefrontToken);
    clients.set(key, client);
  }
  return client;
}

/** The classic env-configured client (single-tenant mode). */
export const storefront: Storefront = getStorefront();
