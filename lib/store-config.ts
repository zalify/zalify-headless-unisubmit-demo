/**
 * Store resolution for the multi-tenant deployment.
 *
 * One deployment can serve every store in the repo's stores/ registry:
 * middleware.ts matches the request Host against the build-time
 * generated registry (lib/store-registry.generated.ts) and rewrites to
 * /s/<slug>/…, and the /s/[store] routes resolve their StoreConfig by
 * slug here.
 *
 * Multi-tenancy is additive: with an empty registry (standalone
 * `zalify theme create` scaffolds) nothing matches, no rewrite happens,
 * and the app behaves exactly like the classic single-store template —
 * `defaultStoreConfig` carries the NEXT_PUBLIC_STORE_DOMAIN /
 * NEXT_PUBLIC_STOREFRONT_API_TOKEN env pair (empty → mock.shop).
 *
 * Pure module (no next/* imports) so the edge middleware can share the
 * exact same host-matching logic as server actions and API routes.
 */
import {STORE_REGISTRY} from './store-registry.generated';

export interface StoreConfig {
  slug: string;
  name?: string;
  /** myshopify domain; '' → mock.shop demo API. */
  storeDomain: string;
  /** Public Storefront API token — public by design. */
  storefrontToken: string;
  /** Public hostname (registry stores only). */
  host?: string;
}

/** Slug reserved for the env-configured single-tenant store. */
export const DEFAULT_STORE_SLUG = 'default';

/** The classic env-configured store — single-tenant fallback. */
export const defaultStoreConfig: StoreConfig = {
  slug: DEFAULT_STORE_SLUG,
  storeDomain: process.env.NEXT_PUBLIC_STORE_DOMAIN || '',
  storefrontToken: process.env.NEXT_PUBLIC_STOREFRONT_API_TOKEN || '',
};

/** Every registry store (multi-tenant deployments; empty otherwise). */
export function allStores(): StoreConfig[] {
  return STORE_REGISTRY;
}

/** Registry store by slug, or null (never resolves 'default'). */
export function getStoreBySlug(slug: string): StoreConfig | null {
  return STORE_REGISTRY.find((entry) => entry.slug === slug) ?? null;
}

/** Hosts treated as "local/dev" for the DEV_STORE mapping. */
const DEV_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])$|\.vercel\.app$/;

/** The store domain shown to components (menu URL localization etc.). */
export function publicDomainOf(store: StoreConfig): string {
  return store.storeDomain || 'mock.shop';
}

/**
 * Match a Host header against the registry. Localhost and *.vercel.app
 * preview hosts map to the store named by the DEV_STORE env var (a
 * slug) when set — handy for local testing without editing /etc/hosts.
 * DEV_STORE unset keeps dev hosts on the env-configured single-tenant
 * store (today's behavior). Returns null when nothing matches.
 */
export function matchStoreByHost(hostHeader: string | null): StoreConfig | null {
  if (!STORE_REGISTRY.length || !hostHeader) return null;
  const host = hostHeader.split(':')[0]!.toLowerCase();
  const entry = STORE_REGISTRY.find((candidate) => candidate.host === host);
  if (entry) return entry;
  const devSlug = process.env.DEV_STORE || process.env.NEXT_PUBLIC_DEV_STORE;
  if (devSlug && DEV_HOST_RE.test(host)) return getStoreBySlug(devSlug);
  return null;
}

/**
 * The store a request belongs to, for handlers that see the Host but
 * not the /s/[store] route param (server actions, API routes). Falls
 * back to the env-configured store — matching the middleware, which
 * only rewrites matched hosts.
 */
export function getRequestStore(hostHeader: string | null): StoreConfig {
  return matchStoreByHost(hostHeader) ?? defaultStoreConfig;
}
