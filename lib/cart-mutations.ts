/**
 * Cart mutations against the Storefront API — the server half of the
 * cart, shared by the /api/cart route handler (the single mutation
 * endpoint, hydrated *and* no-JS) and any server code that needs to
 * change a cart.
 *
 * Deliberately NOT a 'use server' module: these are plain functions,
 * not server actions. The cart speaks one HTTP contract instead of a
 * server-action id per operation, which is what lets the client store
 * abort an in-flight mutation (lib/cart-store.ts) — server actions
 * are not cancelable.
 *
 * Every mutation is expressed as an *intent*, the vocabulary the cart
 * forms post: add / increase / decrease / set / remove /
 * discount-apply / discount-remove / note-update. `applyCartIntent`
 * is the whole surface; it creates the cart on first add, and returns
 * the fresh cart plus the id to persist in the store's cookie.
 *
 * Multi-tenant: the caller resolves the StoreConfig (Host header in
 * the route handler) and passes it in, so the mutation always lands
 * on the cart of the store that served the page.
 */
import {getStorefront} from './storefront';
import type {StoreConfig} from './store-config';
import {CART_FRAGMENT} from './fragments';
import type {CartData} from './cart';

/** The mutation vocabulary the cart forms post as `intent`. */
export const CART_INTENTS = [
  'add',
  'increase',
  'decrease',
  'set',
  'remove',
  'discount-apply',
  'discount-remove',
  'note-update',
] as const;

export type CartIntent = (typeof CART_INTENTS)[number];

export function isCartIntent(value: unknown): value is CartIntent {
  return (
    typeof value === 'string' &&
    (CART_INTENTS as readonly string[]).includes(value)
  );
}

/** Fields a cart form may carry, whatever the intent. */
export interface CartIntentInput {
  intent: CartIntent;
  /** add */
  merchandiseId?: string;
  sellingPlanId?: string;
  /** add, set */
  quantity?: number;
  /** increase, decrease, set, remove */
  lineId?: string;
  /** discount-apply, discount-remove */
  discountCode?: string;
  /** note-update */
  note?: string;
}

export interface CartIntentResult {
  cart: CartData | null;
  /** Set when a cart was created — the caller persists it in the cookie. */
  newCartId?: string;
  userErrors: Array<{message?: string}>;
}

const CART_CREATE_MUTATION = `#graphql
  mutation CartCreate($input: CartInput!, $numCartLines: Int = 100) {
    cartCreate(input: $input) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $numCartLines: Int = 100) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $numCartLines: Int = 100) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $numCartLines: Int = 100) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

const CART_DISCOUNT_MUTATION = `#graphql
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!], $numCartLines: Int = 100) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

const CART_NOTE_MUTATION = `#graphql
  mutation CartNoteUpdate($cartId: ID!, $note: String!, $numCartLines: Int = 100) {
    cartNoteUpdate(cartId: $cartId, note: $note) {
      cart { ...CartApiQuery }
      userErrors { field message }
    }
  }
  ${CART_FRAGMENT}
` as const;

/** Run a cart mutation and unwrap its single-key payload. */
async function mutate(
  store: StoreConfig,
  mutation: string,
  variables: Record<string, unknown>,
): Promise<{cart: CartData | null; userErrors: Array<{message?: string}>}> {
  const data = await getStorefront(store).query(mutation, {variables});
  const payload = (data?.[Object.keys(data ?? {})[0] ?? ''] ?? {}) as {
    cart?: CartData | null;
    userErrors?: Array<{message?: string}>;
  };
  return {cart: payload.cart ?? null, userErrors: payload.userErrors ?? []};
}

/** Quantity of the line the intent targets, read off the current cart. */
function lineQuantity(cart: CartData | null, lineId: string): number {
  const nodes = (cart?.lines?.nodes ?? []) as Array<{
    id?: string;
    quantity?: number;
  }>;
  return nodes.find((line) => line.id === lineId)?.quantity ?? 0;
}

/**
 * Apply one cart intent.
 *
 * `cartId` is the store's current cart (null when there is none). Only
 * `add` may run without one — it creates the cart and reports the new
 * id via `newCartId`; every other intent needs a cart and no-ops
 * (returning the cart unchanged) without one, because there is nothing
 * to mutate and creating one would be surprising.
 *
 * `currentCart` is optional and only used to resolve relative
 * quantities (increase/decrease) — pass it when you already have the
 * cart to avoid a second read.
 */
export async function applyCartIntent(
  store: StoreConfig,
  cartId: string | null,
  input: CartIntentInput,
  currentCart?: CartData | null,
): Promise<CartIntentResult> {
  const {intent} = input;

  if (intent === 'add') {
    const merchandiseId = input.merchandiseId ?? '';
    const quantity = Math.max(1, Number(input.quantity) || 1);
    if (!merchandiseId) {
      return {cart: null, userErrors: [{message: 'Nothing to add'}]};
    }
    const line: Record<string, unknown> = {merchandiseId, quantity};
    if (input.sellingPlanId) line.sellingPlanId = input.sellingPlanId;

    if (cartId) {
      const payload = await mutate(store, CART_LINES_ADD_MUTATION, {
        cartId,
        lines: [line],
      });
      // An expired or foreign cart id answers with no cart and no
      // user errors — fall through to a fresh cart instead of
      // silently dropping the add.
      if (payload.cart || payload.userErrors.length) return payload;
    }

    const created = await mutate(store, CART_CREATE_MUTATION, {
      input: {lines: [line]},
    });
    return {
      ...created,
      ...(created.cart?.id ? {newCartId: created.cart.id} : {}),
    };
  }

  if (!cartId) return {cart: currentCart ?? null, userErrors: []};

  switch (intent) {
    case 'remove': {
      const lineId = input.lineId ?? '';
      if (!lineId) return {cart: currentCart ?? null, userErrors: []};
      return mutate(store, CART_LINES_REMOVE_MUTATION, {
        cartId,
        lineIds: [lineId],
      });
    }

    case 'increase':
    case 'decrease':
    case 'set': {
      const lineId = input.lineId ?? '';
      if (!lineId) return {cart: currentCart ?? null, userErrors: []};

      let quantity: number;
      if (intent === 'set') {
        quantity = Math.max(0, Number(input.quantity) || 0);
      } else {
        // Relative intents resolve against server truth, not against a
        // number the client sent — two rapid clicks can't compound a
        // stale base quantity into the wrong result.
        const cart = currentCart ?? (await readCart(store, cartId));
        const step = intent === 'increase' ? 1 : -1;
        quantity = Math.max(0, lineQuantity(cart, lineId) + step);
      }

      if (quantity === 0) {
        return mutate(store, CART_LINES_REMOVE_MUTATION, {
          cartId,
          lineIds: [lineId],
        });
      }
      return mutate(store, CART_LINES_UPDATE_MUTATION, {
        cartId,
        lines: [{id: lineId, quantity}],
      });
    }

    case 'discount-apply':
    case 'discount-remove': {
      const code = (input.discountCode ?? '').trim();
      if (!code) return {cart: currentCart ?? null, userErrors: []};
      // cartDiscountCodesUpdate replaces the whole list, so the
      // already-applicable codes are resent alongside the change.
      const cart = currentCart ?? (await readCart(store, cartId));
      const applied = (cart?.discountCodes ?? [])
        .filter((entry) => entry.applicable)
        .map((entry) => entry.code);
      const discountCodes =
        intent === 'discount-apply'
          ? Array.from(new Set([...applied, code]))
          : applied.filter((applied_) => applied_ !== code);
      return mutate(store, CART_DISCOUNT_MUTATION, {cartId, discountCodes});
    }

    case 'note-update':
      return mutate(store, CART_NOTE_MUTATION, {
        cartId,
        note: input.note ?? '',
      });
  }
}

const CART_QUERY = `#graphql
  query CartQuery($cartId: ID!, $numCartLines: Int = 100) {
    cart(id: $cartId) { ...CartApiQuery }
  }
  ${CART_FRAGMENT}
` as const;

/** Read a cart by id. Returns null when it expired or the read fails. */
export async function readCart(
  store: StoreConfig,
  cartId: string,
): Promise<CartData | null> {
  try {
    const data = await getStorefront(store).query(CART_QUERY, {
      variables: {cartId},
    });
    return (data?.cart as CartData) ?? null;
  } catch (error) {
    // A broken cart must never take down the page or the endpoint.
    // eslint-disable-next-line no-console
    console.error('[cart] failed to load cart', error);
    return null;
  }
}
