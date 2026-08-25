/**
 * The optimistic cart store — framework-free, driven by
 * components/cart/cart-context.tsx.
 *
 * Model: the store keeps the last **confirmed** cart (server truth)
 * plus an ordered list of **in-flight optimistic ops**. The state a
 * component reads is `confirmed` with every op replayed on top. That
 * is what makes rollback trivial and race-free: a failed mutation
 * simply drops its op and the next derive() re-renders without it —
 * no snapshot to restore, no way for two concurrent failures to
 * resurrect each other's state.
 *
 * Three properties this buys over a server-action round trip:
 *
 * - **Instant feedback.** Quantity, line totals, cart totals and the
 *   header count update on click; the server reconciles a moment
 *   later. The Storefront API stays the authority — every response
 *   replaces `confirmed` wholesale.
 * - **Per-entity serialization.** Each mutation is keyed by the entity
 *   it touches (`line:<id>`, `discount:<code>`, `note`, `add`), and at
 *   most one request per key is ever in flight. A submission arriving
 *   while one is out replaces the queued one, so hammering −/−/− on a
 *   line coalesces into two requests and needs no debounce.
 * - **Rollback.** A failed mutation drops its op and emits
 *   commerce-core's 'cart:error'; the UI snaps back to server truth.
 *
 * Relative intents are resolved to absolute quantities *here* before
 * posting (increase/decrease → intent=set with the derived target), so
 * every request is idempotent and carries no dependence on what the
 * server already applied.
 *
 * That alone is *not* enough, which is worth spelling out because the
 * obvious design gets it wrong: superseding a mutation by aborting its
 * fetch (what the Hydrogen preview does) only stops the client
 * waiting. The server may still apply the aborted request, and a burst
 * can therefore settle in whatever order the API processed — leaving
 * server truth behind the UI permanently, since nothing re-reads it.
 * Queueing instead of aborting is what makes the last write genuinely
 * last. `acceptedSeq` covers the remaining gap across *different*
 * entities, whose responses can still overtake each other.
 *
 * The relative intents still exist server-side for the no-JS path,
 * where each post is a full page round trip and cannot race.
 */
import {emit} from '@zalify/storefront-kit/commerce';
import type {CartData} from '~/lib/cart';

export interface CartPending {
  /** Line ids with a mutation in flight. */
  lines: Set<string>;
  /** Discount codes with a mutation in flight. */
  discountCodes: Set<string>;
  /** True while the order note is being saved. */
  note: boolean;
  /** True while an add-to-cart is in flight. */
  add: boolean;
}

export interface CartState {
  /** Confirmed cart + optimistic ops. Never null — empty when absent. */
  data: CartData;
  /** True until the server-streamed bootstrap resolves. */
  loading: boolean;
  pending: CartPending;
  /** Message of the last failed mutation, cleared on the next success. */
  error: string | null;
}

/** Intents a hydrated form may submit. */
export type CartFormIntent =
  | 'add'
  | 'increase'
  | 'decrease'
  | 'set'
  | 'remove'
  | 'discount-apply'
  | 'discount-remove'
  | 'note-update';

export const CART_FORM_INTENTS: readonly CartFormIntent[] = [
  'add',
  'increase',
  'decrease',
  'set',
  'remove',
  'discount-apply',
  'discount-remove',
  'note-update',
];

export function isCartFormIntent(value: string): value is CartFormIntent {
  return (CART_FORM_INTENTS as readonly string[]).includes(value);
}

export interface CartSubmission {
  intent: CartFormIntent;
  merchandiseId?: string;
  sellingPlanId?: string;
  quantity?: number;
  lineId?: string;
  discountCode?: string;
  note?: string;
}

const EMPTY_PENDING: CartPending = {
  lines: new Set(),
  discountCodes: new Set(),
  note: false,
  add: false,
};

const EMPTY_CART: CartData = {
  id: '',
  totalQuantity: 0,
  lines: {nodes: []},
  cost: {},
  discountCodes: [],
};

/**
 * Stable initial state, shared by the server render and the client's
 * first snapshot so hydration always matches (the provider resolves
 * the streamed bootstrap in an effect, i.e. after hydration).
 */
export const INITIAL_CART_STATE: CartState = {
  data: EMPTY_CART,
  loading: true,
  pending: EMPTY_PENDING,
  error: null,
};

/* ---------------------------- optimistic ops --------------------------- */

type CartOp =
  | {kind: 'quantity'; lineId: string; quantity: number}
  | {kind: 'remove'; lineId: string}
  | {kind: 'add'; quantity: number}
  | {kind: 'discount-apply'; code: string}
  | {kind: 'discount-remove'; code: string}
  | {kind: 'note'; note: string};

interface CartLineNode {
  id?: string;
  quantity?: number;
  cost?: {
    totalAmount?: {amount: string; currencyCode: string};
    amountPerQuantity?: {amount: string; currencyCode: string};
  };
  [key: string]: unknown;
}

function money(amount: number, currencyCode: string) {
  return {amount: amount.toFixed(2), currencyCode};
}

/**
 * Recompute the numbers a shopper watches while a mutation is in
 * flight: line totals from unit price × quantity, then cart quantity
 * and subtotal/total from the lines. Discounts and tax are left to the
 * server — they can't be derived client-side, and the reconcile is one
 * round trip away.
 */
function recompute(cart: CartData, extraQuantity: number): CartData {
  const nodes = (cart.lines?.nodes ?? []) as CartLineNode[];
  let quantity = 0;
  let subtotal = 0;
  let currencyCode = '';

  const lines = nodes.map((line) => {
    const unit = line.cost?.amountPerQuantity;
    quantity += line.quantity ?? 0;
    if (!unit) return line;
    currencyCode ||= unit.currencyCode;
    const lineTotal = Number(unit.amount) * (line.quantity ?? 0);
    subtotal += lineTotal;
    return {
      ...line,
      cost: {...line.cost, totalAmount: money(lineTotal, unit.currencyCode)},
    };
  });

  const previousSubtotal = Number(cart.cost?.subtotalAmount?.amount ?? 0);
  const previousTotal = Number(cart.cost?.totalAmount?.amount ?? 0);
  // Carry the server's discount/tax delta over to the optimistic total
  // instead of dropping it — the total must not jump to the undiscounted
  // sum for the beat before the server answers.
  const adjustment = previousTotal - previousSubtotal;
  const totalCurrency =
    cart.cost?.totalAmount?.currencyCode ?? (currencyCode || 'USD');

  return {
    ...cart,
    totalQuantity: quantity + extraQuantity,
    lines: {...cart.lines, nodes: lines},
    cost: currencyCode
      ? {
          ...cart.cost,
          subtotalAmount: money(subtotal, currencyCode),
          totalAmount: money(Math.max(0, subtotal + adjustment), totalCurrency),
        }
      : cart.cost,
  };
}

function applyOps(confirmed: CartData | null, ops: CartOp[]): CartData {
  if (!confirmed) {
    // No cart yet: the only meaningful optimistic state is "an add is
    // on its way", which the header count and the drawer both read.
    const adding = ops.reduce(
      (sum, op) => (op.kind === 'add' ? sum + op.quantity : sum),
      0,
    );
    return adding ? {...EMPTY_CART, totalQuantity: adding} : EMPTY_CART;
  }

  let cart: CartData = confirmed;
  let extraQuantity = 0;

  for (const op of ops) {
    const nodes = (cart.lines?.nodes ?? []) as CartLineNode[];
    switch (op.kind) {
      case 'quantity':
        cart = {
          ...cart,
          lines: {
            ...cart.lines,
            nodes: op.quantity
              ? nodes.map((line) =>
                  line.id === op.lineId
                    ? {...line, quantity: op.quantity}
                    : line,
                )
              : nodes.filter((line) => line.id !== op.lineId),
          },
        };
        break;

      case 'remove':
        cart = {
          ...cart,
          lines: {
            ...cart.lines,
            nodes: nodes.filter((line) => line.id !== op.lineId),
          },
        };
        break;

      case 'add':
        extraQuantity += op.quantity;
        break;

      case 'discount-apply':
        cart = {
          ...cart,
          discountCodes: [
            ...(cart.discountCodes ?? []).filter(
              (entry) => entry.code !== op.code,
            ),
            {code: op.code, applicable: true},
          ],
        };
        break;

      case 'discount-remove':
        cart = {
          ...cart,
          discountCodes: (cart.discountCodes ?? []).filter(
            (entry) => entry.code !== op.code,
          ),
        };
        break;

      case 'note':
        cart = {...cart, note: op.note};
        break;
    }
  }

  return recompute(cart, extraQuantity);
}

/* -------------------------------- store -------------------------------- */

/** The entity a mutation touches — the serialization/pending key. */
function entityKey(submission: CartSubmission): string {
  switch (submission.intent) {
    case 'add':
      return 'add';
    case 'note-update':
      return 'note';
    case 'discount-apply':
    case 'discount-remove':
      return `discount:${submission.discountCode ?? ''}`;
    default:
      return `line:${submission.lineId ?? ''}`;
  }
}

/**
 * One entry per entity being mutated. At most one request per entity is
 * ever in flight; a submission arriving while one is out replaces
 * `queued` rather than racing it, and `op` holds that entity's single
 * (absolute) optimistic state.
 */
interface CartEntity {
  op: CartOp | null;
  inflight: boolean;
  queued: CartSubmission | null;
}

export interface CartStore {
  subscribe: (listener: () => void) => () => void;
  getState: () => CartState;
  /** Feed the store the server-streamed bootstrap (once, after hydration). */
  bootstrap: (cart: CartData | null) => void;
  /** Run a mutation: optimistic apply → POST → reconcile or roll back. */
  submit: (submission: CartSubmission) => Promise<void>;
}

export function createCartStore(endpoint = '/api/cart'): CartStore {
  const listeners = new Set<() => void>();
  /** Insertion-ordered, so ops replay in the order they were made. */
  const entities = new Map<string, CartEntity>();
  /** Guards against an older response clobbering a newer one. */
  let requestSeq = 0;
  let acceptedSeq = 0;

  let confirmed: CartData | null = null;
  let loading = true;
  let error: string | null = null;
  let snapshot: CartState = INITIAL_CART_STATE;

  function derive(): CartState {
    const ops: CartOp[] = [];
    const lines = new Set<string>();
    const discountCodes = new Set<string>();
    let note = false;
    let add = false;

    for (const [key, entity] of entities) {
      if (entity.op) ops.push(entity.op);
      if (key === 'note') note = true;
      else if (key === 'add') add = true;
      else if (key.startsWith('line:')) lines.add(key.slice(5));
      else if (key.startsWith('discount:')) discountCodes.add(key.slice(9));
    }

    return {
      data: applyOps(confirmed, ops),
      loading,
      pending: {lines, discountCodes, note, add},
      error,
    };
  }

  function notify(): void {
    snapshot = derive();
    for (const listener of listeners) listener();
  }

  /** Absolute target quantity for a relative intent, from derived state. */
  function resolveQuantity(submission: CartSubmission): number {
    const nodes = (snapshot.data.lines?.nodes ?? []) as CartLineNode[];
    const current =
      nodes.find((line) => line.id === submission.lineId)?.quantity ?? 0;
    if (submission.intent === 'increase') return current + 1;
    if (submission.intent === 'decrease') return Math.max(0, current - 1);
    return Math.max(0, submission.quantity ?? 0);
  }

  function optimisticOp(
    submission: CartSubmission,
    quantity: number,
  ): CartOp | null {
    switch (submission.intent) {
      case 'add':
        // A line can't be synthesized without the variant's price and
        // media, so only the count moves until the server answers.
        return {kind: 'add', quantity: Math.max(1, submission.quantity ?? 1)};
      case 'remove':
        return submission.lineId
          ? {kind: 'remove', lineId: submission.lineId}
          : null;
      case 'increase':
      case 'decrease':
      case 'set':
        return submission.lineId
          ? {kind: 'quantity', lineId: submission.lineId, quantity}
          : null;
      case 'discount-apply':
        return submission.discountCode
          ? {kind: 'discount-apply', code: submission.discountCode}
          : null;
      case 'discount-remove':
        return submission.discountCode
          ? {kind: 'discount-remove', code: submission.discountCode}
          : null;
      case 'note-update':
        return {kind: 'note', note: submission.note ?? ''};
    }
  }

  /** Post one mutation and drain that entity's queue behind it. */
  async function run(key: string, body: CartSubmission): Promise<void> {
    const entity = entities.get(key);
    if (!entity) return;
    entity.inflight = true;
    const seq = ++requestSeq;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Cart update failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        cart?: CartData | null;
        errors?: string[];
      };
      // Responses for *different* entities can still overtake each
      // other, so an older one must never replace newer server truth.
      if (seq > acceptedSeq) {
        acceptedSeq = seq;
        confirmed = payload.cart ?? confirmed;
      }
      error = payload.errors?.length ? payload.errors.join(' ') : null;
      loading = false;
      if (error) emit('cart:error', {message: error});
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Cart update failed';
      emit('cart:error', {message: error});
      // Roll back to server truth: drop the queue and the optimistic op.
      entity.queued = null;
    } finally {
      entity.inflight = false;
      const next = entity.queued;
      if (next) {
        entity.queued = null;
        notify();
        await run(key, next);
        return;
      }
      // Drained: the op has been folded into `confirmed` (or rolled
      // back), so dropping the entity is what un-dims the UI.
      entities.delete(key);
      notify();
    }
  }

  async function submit(submission: CartSubmission): Promise<void> {
    const key = entityKey(submission);
    const entity: CartEntity = entities.get(key) ?? {
      op: null,
      inflight: false,
      queued: null,
    };

    // Resolved against the *derived* quantity, so a burst of clicks
    // steps 2→3→4→5→6 rather than all resolving off the same base.
    const quantity = resolveQuantity(submission);
    // One absolute op per entity: the newest target replaces the last,
    // it does not stack on top of it.
    entity.op = optimisticOp(submission, quantity);
    entities.set(key, entity);

    // Relative intents were resolved above — post the absolute target,
    // which makes each request idempotent and order-independent.
    const body: CartSubmission =
      submission.intent === 'increase' || submission.intent === 'decrease'
        ? {intent: 'set', lineId: submission.lineId, quantity}
        : submission;

    // Serialize per entity. Aborting the previous request (the obvious
    // move, and what the Hydrogen preview does) is *not* enough: an
    // aborted fetch only stops the client waiting, the server may still
    // apply it, and then a burst can settle in whatever order the API
    // happened to process — leaving server truth behind the UI with
    // nothing to correct it. Holding the newest submission until the
    // one in flight returns makes the last write genuinely last, and
    // coalesces a burst into two requests instead of one per click.
    if (entity.inflight) {
      entity.queued = body;
      notify();
      return;
    }

    notify();
    await run(key, body);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => snapshot,
    bootstrap(cart) {
      confirmed = cart;
      loading = false;
      notify();
    },
    submit,
  };
}
