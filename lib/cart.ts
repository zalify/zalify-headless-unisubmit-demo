/**
 * Cart access for server components — the Next.js mirror of Hydrogen's
 * `context.cart`. The cart id lives in an httpOnly cookie; mutations
 * go through the /api/cart route handler (app/api/cart/route.ts) on
 * top of lib/cart-mutations.ts.
 *
 * The cookie stays httpOnly: the client store never reads it, it only
 * POSTs to /api/cart and the browser attaches the cookie itself.
 *
 * Multi-tenant: each store gets its own cookie ('cart' for the classic
 * env-configured store, 'cart_<slug>' for registry stores) so tenants
 * served from one deployment never share a cart.
 */
import {cookies} from 'next/headers';
import {
  defaultStoreConfig,
  DEFAULT_STORE_SLUG,
  type StoreConfig,
} from './store-config';
import {readCart} from './cart-mutations';

/** Legacy single-tenant cookie name (kept for the default store). */
export const CART_COOKIE = 'cart';

/** Two weeks, matching the Storefront API's own cart lifetime. */
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

/** Per-store cart cookie name. */
export function cartCookieName(store: StoreConfig): string {
  if (store.slug === DEFAULT_STORE_SLUG) return CART_COOKIE;
  return `${CART_COOKIE}_${store.slug.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export interface CartData {
  id: string;
  checkoutUrl?: string;
  totalQuantity?: number;
  note?: string | null;
  lines?: {nodes?: Array<Record<string, any>>};
  cost?: Record<string, any>;
  discountCodes?: Array<{code: string; applicable: boolean}>;
  discountAllocations?: Array<Record<string, any>>;
  [key: string]: unknown;
}

/**
 * Validate a raw cookie value as a Storefront cart id.
 *
 * Tolerates percent-encoding, then requires a cart GID — this guards
 * against foreign `cart` cookies on the same host (other storefront
 * runtimes store their cart id in a different format), which would
 * otherwise reach the API as an invalid $cartId.
 */
export function normalizeCartId(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // keep raw
  }
  return value.startsWith('gid://shopify/Cart/') ? value : null;
}

export async function getCartId(
  store: StoreConfig = defaultStoreConfig,
): Promise<string | null> {
  const jar = await cookies();
  return normalizeCartId(jar.get(cartCookieName(store))?.value);
}

/** The current cart, or null when there is none (or the id expired). */
export async function getCart(
  store: StoreConfig = defaultStoreConfig,
): Promise<CartData | null> {
  const cartId = await getCartId(store);
  if (!cartId) return null;
  return readCart(store, cartId);
}
