/**
 * /api/cart — the single cart endpoint, replacing the per-operation
 * server actions. The client store (components/cart/cart-store.ts)
 * GETs the cart here and POSTs every mutation intent; forms degrade
 * to a native POST here when JS is off and are answered with a
 * redirect back to the page they came from.
 *
 * One endpoint instead of six server actions is what buys the
 * optimistic UI: a fetch can be aborted (so a superseded quantity
 * mutation is cancelled per line) and answers with the fresh cart in
 * the same round trip, where a server action would force a
 * revalidatePath re-render of the whole route.
 *
 * Multi-tenant: the middleware matcher skips /api, so the store is
 * resolved here from the Host header with the same registry matching
 * the middleware uses — the mutation lands on the cart of the store
 * that served the page, and the response sets that store's cookie.
 */
import {NextResponse} from 'next/server';
import {getRequestStore, type StoreConfig} from '~/lib/store-config';
import {
  CART_COOKIE_MAX_AGE,
  cartCookieName,
  normalizeCartId,
  type CartData,
} from '~/lib/cart';
import {
  applyCartIntent,
  isCartIntent,
  readCart,
  type CartIntentInput,
} from '~/lib/cart-mutations';

/** The cart is per-user runtime data — never prerender or cache it. */
export const dynamic = 'force-dynamic';

function storeOf(request: Request): StoreConfig {
  return getRequestStore(request.headers.get('host'));
}

/** The store's cart id from the request cookies (validated). */
function cartIdOf(request: Request, store: StoreConfig): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const name = cartCookieName(store);
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return normalizeCartId(match?.[1]);
}

function withCartCookie(
  response: NextResponse,
  store: StoreConfig,
  cartId: string,
): NextResponse {
  response.cookies.set(cartCookieName(store), cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
  return response;
}

/** The current cart. `{cart: null}` means "checked, and there is none". */
export async function GET(request: Request) {
  const store = storeOf(request);
  const cartId = cartIdOf(request, store);
  const cart = cartId ? await readCart(store, cartId) : null;
  return NextResponse.json({cart});
}

/**
 * Read the intent payload from either a fetch (JSON, the hydrated
 * store) or a native form post (FormData, the no-JS path). Both carry
 * the same field names, so the theme's forms are valid in both modes.
 */
async function readInput(
  request: Request,
): Promise<{input: CartIntentInput | null; isFormPost: boolean}> {
  const contentType = request.headers.get('content-type') ?? '';
  const isFormPost =
    contentType.includes('form-data') ||
    contentType.includes('x-www-form-urlencoded');

  const raw: Record<string, unknown> = {};
  if (isFormPost) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') raw[key] = value;
    }
  } else {
    Object.assign(raw, (await request.json().catch(() => ({}))) as object);
  }

  if (!isCartIntent(raw.intent)) return {input: null, isFormPost};

  return {
    input: {
      intent: raw.intent,
      ...(raw.merchandiseId ? {merchandiseId: String(raw.merchandiseId)} : {}),
      ...(raw.sellingPlanId ? {sellingPlanId: String(raw.sellingPlanId)} : {}),
      ...(raw.quantity != null ? {quantity: Number(raw.quantity)} : {}),
      ...(raw.lineId ? {lineId: String(raw.lineId)} : {}),
      ...(raw.discountCode ? {discountCode: String(raw.discountCode)} : {}),
      ...(raw.note != null ? {note: String(raw.note)} : {}),
    },
    isFormPost,
  };
}

/** Where a no-JS form post returns to (the page that submitted it). */
function refererPath(request: Request): string {
  const referer = request.headers.get('referer');
  if (!referer) return '/cart';
  try {
    return new URL(referer).pathname || '/cart';
  } catch {
    return '/cart';
  }
}

export async function POST(request: Request) {
  const store = storeOf(request);
  const {input, isFormPost} = await readInput(request);

  if (!input) {
    return NextResponse.json(
      {error: 'Unknown or missing cart intent'},
      {status: 400},
    );
  }

  const cartId = cartIdOf(request, store);
  // Relative intents (increase/decrease) and the discount list resolve
  // against server truth, so hand the mutation the current cart.
  const currentCart: CartData | null = cartId
    ? await readCart(store, cartId)
    : null;

  let result;
  try {
    result = await applyCartIntent(store, cartId, input, currentCart);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[cart] mutation failed', error);
    const message =
      error instanceof Error ? error.message : 'Cart update failed';
    if (isFormPost) {
      return NextResponse.redirect(new URL(refererPath(request), request.url), {
        status: 303,
      });
    }
    return NextResponse.json({error: message}, {status: 502});
  }

  const errors = result.userErrors
    .map((error) => error.message)
    .filter(Boolean) as string[];

  // No-JS: bounce back to the page. The re-request renders the fresh
  // cart server-side, which is the whole update mechanism without JS.
  if (isFormPost) {
    const response = NextResponse.redirect(
      new URL(refererPath(request), request.url),
      {status: 303},
    );
    return result.newCartId
      ? withCartCookie(response, store, result.newCartId)
      : response;
  }

  const response = NextResponse.json({
    cart: result.cart,
    ...(errors.length ? {errors} : {}),
  });
  return result.newCartId
    ? withCartCookie(response, store, result.newCartId)
    : response;
}
