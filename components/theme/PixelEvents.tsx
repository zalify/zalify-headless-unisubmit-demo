'use client';
/**
 * Zalify Pixel commerce events — ONE central bridge instead of tracking
 * code sprinkled through the theme. Every payload is derived from state
 * the theme already maintains, so call sites carry zero analytics code:
 *
 * - product_viewed / collection_viewed: fired when the page's resource
 *   store holds a product/collection (the same complete data the server
 *   fetched to render the page), keyed per pathname so SPA navigations
 *   fire again.
 * - product_added_to_cart: fired by diffing the optimistic cart store's
 *   reconciled lines — covers every add path (PDP form, card quick-add,
 *   quick-add dialog, drawer qty steppers) with the line's real
 *   merchandise data. The first loaded snapshot is the baseline, so a
 *   returning visitor's existing cart never fires adds.
 * - checkout_started: a delegated click listener matching the cart's
 *   own checkoutUrl — no handler on any anchor.
 * - search_submitted: fired from the search page's searchResult
 *   resource (term), deduped per term.
 *
 * Event names and payload shapes mirror Zalify's own Shopify web-pixel
 * subscriber contract (zalify-pixel sdk/src/typings/webPixels.d.ts —
 * ViewProductEvent / ProductAddedToCartEvent / CheckoutEvent): numeric
 * amounts, image.src, sku, product {id, title, vendor}, cartLine.cost,
 * the full checkout envelope. The pixel wraps events with its own
 * context (document/navigator/window) — only `data` is supplied here.
 * Docs: cdn.zalify.com/llms.txt
 */
import {useEffect, useRef, useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {useCart, type CartState} from '~/components/cart/cart-context';
import {
  getPixelResources,
  getServerPixelResources,
  subscribePixelResources,
} from '~/lib/pixel-resources';
import {setPixelProperty, trackPixel} from '~/lib/pixel';

const selectData = (state: CartState) => state.data;
const selectLoading = (state: CartState) => state.loading;

type Money = {amount: number; currencyCode: string};

function money(m: any): Money {
  return {
    amount: Number(m?.amount ?? 0),
    currencyCode: m?.currencyCode ?? '',
  };
}

/** Variant chosen by the ?variant param, else the first variant. */
function selectedVariant(product: any): any {
  const nodes: any[] = product?.variants?.nodes ?? [];
  if (typeof window !== 'undefined') {
    const wanted = new URLSearchParams(window.location.search).get('variant');
    if (wanted) {
      const match = nodes.find(
        (v) => String(v.id).endsWith(`/${wanted}`) || v.id === wanted,
      );
      if (match) return match;
    }
  }
  return (
    product?.selectedOrFirstAvailableVariant ??
    product?.selectedVariant ??
    nodes[0] ??
    null
  );
}

/** webPixels.d.ts ViewProductEvent["data"]["productVariant"]. */
function productVariantPayload(product: any, variant: any) {
  return {
    id: variant?.id ?? product?.id ?? '',
    image: {src: variant?.image?.url ?? product?.featuredImage?.url ?? ''},
    price: money(variant?.price),
    sku: variant?.sku ?? null,
    title: variant?.title ?? product?.title ?? '',
    product: {
      id: product?.id ?? '',
      title: product?.title ?? '',
      vendor: product?.vendor ?? '',
    },
  };
}

/** webPixels.d.ts ProductAddedToCartEvent["data"]["cartLine"]["merchandise"] /
 *  CheckoutEvent lineItems[].variant — same shape from a cart line. */
function lineMerchandisePayload(line: any) {
  const merchandise = line?.merchandise ?? {};
  return {
    id: merchandise.id ?? '',
    image: {src: merchandise.image?.url ?? ''},
    price: money(line?.cost?.amountPerQuantity ?? merchandise.price),
    product: {
      id: merchandise.product?.id ?? '',
      title: merchandise.product?.title ?? '',
      vendor: merchandise.product?.vendor ?? '',
    },
    sku: merchandise.sku ?? null,
    title: merchandise.title ?? null,
  };
}

/** webPixels.d.ts ProductAddedToCartEvent["data"]["cartLine"] for `quantity` added. */
function cartLinePayload(line: any, quantity: number) {
  const perQuantity = money(line?.cost?.amountPerQuantity ?? line?.merchandise?.price);
  return {
    cost: {
      totalAmount: {
        amount: Number((perQuantity.amount * quantity).toFixed(2)),
        currencyCode: perQuantity.currencyCode,
      },
    },
    merchandise: lineMerchandisePayload(line),
    quantity,
  };
}

/**
 * Cart token from the cart GID — Shopify's canonical format INCLUDES the
 * key param since 2024 (`<token>?key=<secret>`, matching the `cart`
 * cookie and /cart.js `token` that Shopify-store pixels read):
 * gid://shopify/Cart/<token>?key=<secret> → <token>?key=<secret>.
 */
function cartToken(cartId: string | undefined): string {
  const id = cartId ?? '';
  const [path = '', query] = id.split('?');
  const token = path.split('/').pop() ?? '';
  return token && query ? `${token}?${query}` : token;
}

/** Checkout URLs carry the same token at /cart/c/<token>?key=… — keep
 *  the key, matching the cart-cookie format. */
function checkoutToken(checkoutUrl: string | undefined): string {
  try {
    const url = new URL(checkoutUrl ?? '');
    const match = /\/c\/([^/?#]+)/.exec(url.pathname);
    if (!match) return '';
    const key = url.searchParams.get('key');
    return key ? `${match[1]}?key=${key}` : (match[1] ?? '');
  } catch {
    return '';
  }
}

/** webPixels.d.ts CheckoutEvent["data"]["checkout"] — fields Shopify only
 *  knows at checkout (email, shipping, order) are null pre-checkout. */
function checkoutPayload(cart: any) {
  const lines: any[] = cart?.lines?.nodes ?? [];
  const totalPrice = money(cart?.cost?.totalAmount);
  return {
    token: checkoutToken(cart?.checkoutUrl),
    currencyCode: totalPrice.currencyCode,
    email: null,
    phone: null,
    lineItems: lines.map((line) => ({
      id: line.id ?? '',
      quantity: Number(line.quantity) || 0,
      title: line.merchandise?.product?.title ?? '',
      variant: lineMerchandisePayload(line),
    })),
    order: {id: null},
    shippingAddress: null,
    subtotalPrice: money(cart?.cost?.subtotalAmount),
    shippingPrice: null,
    totalTax: cart?.cost?.totalTaxAmount ? money(cart.cost.totalTaxAmount) : null,
    totalPrice,
  };
}

export function PixelEvents() {
  const pathname = usePathname();
  const resources = useSyncExternalStore(
    subscribePixelResources,
    getPixelResources,
    getServerPixelResources,
  );
  const product = resources.product as any;
  const collection = resources.collection as any;
  const searchResult = resources.searchResult as any;
  const cart = useCart(selectData);
  const cartLoading = useCart(selectLoading);

  // ---- product_viewed / collection_viewed (per pathname) ----
  const viewedKey = useRef<string | null>(null);
  useEffect(() => {
    if (product?.id && pathname?.startsWith('/products/')) {
      const key = `p:${pathname}:${product.id}`;
      if (viewedKey.current === key) return;
      viewedKey.current = key;
      trackPixel('product_viewed', {
        productVariant: productVariantPayload(product, selectedVariant(product)),
      });
    } else if (searchResult?.term && pathname?.startsWith('/search')) {
      const key = `s:${searchResult.term}`;
      if (viewedKey.current === key) return;
      viewedKey.current = key;
      // webPixels.d.ts SeachEvent["data"] — { searchResult: { query } }.
      trackPixel('search_submitted', {
        searchResult: {query: searchResult.term},
      });
    } else if (collection?.id && pathname?.includes('/collections/')) {
      const key = `c:${pathname}:${collection.id}`;
      if (viewedKey.current === key) return;
      viewedKey.current = key;
      trackPixel('collection_viewed', {
        collection: {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
        },
        items: (collection.products?.nodes ?? [])
          .slice(0, 24)
          .map((node: any) => ({
            id: node.id,
            title: node.title,
            handle: node.handle,
          })),
      });
    }
  }, [pathname, product, collection, searchResult]);

  // ---- cart_token persistent property ----
  // The pixel normally reads Shopify's JS-visible `cart` cookie; ours is
  // httpOnly by design, so publish the token from the cart store instead
  // (persistent `set` overrides the empty cookie read on every event).
  // Events before the cart bootstrap resolves have no token — same as a
  // first-visit Shopify session before any cart exists.
  const lastToken = useRef<string | null>(null);
  useEffect(() => {
    const token = cartToken(cart?.id as string | undefined);
    if (!token || token === lastToken.current) return;
    lastToken.current = token;
    setPixelProperty('cart_token', token);
  }, [cart]);

  // ---- product_added_to_cart (cart-store line diff) ----
  const baseline = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (cartLoading) return;
    const lines: any[] = cart?.lines?.nodes ?? [];
    const snapshot = new Map<string, number>(
      lines.map((line) => [String(line.id), Number(line.quantity) || 0]),
    );
    if (baseline.current === null) {
      // First reconciled snapshot: an existing cart is not an "add".
      baseline.current = snapshot;
      return;
    }
    for (const line of lines) {
      const previous = baseline.current.get(String(line.id)) ?? 0;
      const delta = (Number(line.quantity) || 0) - previous;
      if (delta > 0) {
        trackPixel('product_added_to_cart', {
          cartLine: cartLinePayload(line, delta),
        });
      }
    }
    baseline.current = snapshot;
  }, [cart, cartLoading]);

  // ---- checkout_started (delegated click on the cart's checkout URL) ----
  const cartRef = useRef(cart);
  cartRef.current = cart;
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      const checkoutUrl = cartRef.current?.checkoutUrl;
      if (!anchor || !checkoutUrl || anchor.href !== checkoutUrl) return;
      trackPixel('checkout_started', {
        checkout: checkoutPayload(cartRef.current),
      });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
