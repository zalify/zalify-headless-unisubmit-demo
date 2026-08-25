'use client';
/**
 * Client-side cart seam: the React bindings over the optimistic store
 * (components/cart/cart-store.ts).
 *
 * The cart lives behind an httpOnly per-store cookie, so it is runtime
 * data that must never enter the static shell. The server layout
 * passes getCart()'s **promise** (not its value) into the provider,
 * which awaits it in an effect — i.e. after hydration, so the first
 * client snapshot always matches the server render and no consumer
 * needs a Suspense boundary or a hydration guard.
 *
 * From then on the store owns the cart: every mutation posts to
 * /api/cart, applies optimistically, and reconciles with the server's
 * response (or rolls back). Consumers *select* state instead of
 * suspending on a promise:
 *
 *   const count = useCart((state) => state.data.totalQuantity);
 *   const pending = useCart((state) => state.pending.lines);
 *   const {formProps, register} = useCartForm();
 *
 * The form contract (`formProps()` + `register()`) keeps every
 * mutation a real <form> posting to /api/cart, so the theme still
 * works with JS off — hydrated, formProps()'s onSubmit intercepts and
 * routes the same fields through the store instead.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type {FormEvent, ReactNode} from 'react';
import type {CartData} from '~/lib/cart';
import {
  createCartStore,
  INITIAL_CART_STATE,
  isCartFormIntent,
  type CartFormIntent,
  type CartState,
  type CartStore,
  type CartSubmission,
} from './cart-store';

export type {CartState} from './cart-store';

const CART_ENDPOINT = '/api/cart';

const CartStoreContext = createContext<CartStore | null>(null);

export function CartProvider({
  cartPromise,
  children,
}: {
  cartPromise: Promise<CartData | null>;
  children: ReactNode;
}) {
  // One store per mount. The promise is a prop, but the store must not
  // be recreated when the layout re-renders with a new one.
  const store = useMemo(() => createCartStore(CART_ENDPOINT), []);
  const bootstrapped = useRef(false);

  // Awaited in an effect on purpose: resolving during render would let
  // the client's first snapshot differ from the server HTML whenever
  // the streamed cart lands before hydration.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;
    // Promise.resolve() is load-bearing, not decoration: a promise
    // streamed from a server component arrives here as React's RSC
    // *thenable*, not a native Promise. Its then() returns undefined,
    // so chaining .catch() straight onto it throws at hydration and
    // takes the whole page down. Normalize first.
    Promise.resolve(cartPromise)
      .then((cart) => {
        if (!cancelled) store.bootstrap(cart);
      })
      .catch((error: unknown) => {
        // A broken cart must never take down the page — bootstrap empty
        // so the UI leaves its loading state and renders empty.
        // eslint-disable-next-line no-console
        console.error('[cart] bootstrap failed', error);
        if (!cancelled) store.bootstrap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cartPromise, store]);

  return (
    <CartStoreContext.Provider value={store}>
      {children}
    </CartStoreContext.Provider>
  );
}

function noopSubscribe(): () => void {
  return () => {};
}

/**
 * Select from the cart state. Re-renders only when the selected value
 * changes identity, so the header count doesn't re-render on a note
 * edit. Outside a provider (isolated renders, tests) it reports the
 * initial state rather than throwing.
 */
export function useCart<T>(selector: (state: CartState) => T): T {
  const store = useContext(CartStoreContext);
  const read = useCallback(
    () => selector(store ? store.getState() : INITIAL_CART_STATE),
    [selector, store],
  );
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    read,
    // The server render and the pre-bootstrap client render agree on
    // the initial state, which is what keeps hydration clean.
    () => selector(INITIAL_CART_STATE),
  );
}

/* ------------------------------ cart forms ----------------------------- */

interface FormPropsOptions {
  beforeSubmit?: () => void;
  afterSubmit?: () => void;
}

interface RegisterOptions {
  value?: string | number;
  defaultValue?: string | number;
}

/**
 * The cart form contract.
 *
 * - `formProps()` spreads onto a <form>: it posts to /api/cart with no
 *   JS, and hydrated it intercepts the submit and routes the fields
 *   through the store.
 * - `register(intent)` on a submit button marks the intent
 *   (`{name: 'intent', value: intent}`).
 * - `register(field, {value | defaultValue})` on an input names a
 *   field the intent needs (lineId, quantity, merchandiseId,
 *   discountCode, note).
 *
 * The intent comes from the submitting button, so one form can carry
 * several (the quantity stepper's −/+/set). A programmatic submit must
 * therefore name its submitter: `form.requestSubmit(button)`, never a
 * bare `requestSubmit()`.
 */
export function useCartForm() {
  const store = useContext(CartStoreContext);

  const formProps = useCallback(
    (options: FormPropsOptions = {}) => ({
      method: 'post' as const,
      action: CART_ENDPOINT,
      onSubmit: (event: FormEvent<HTMLFormElement>) => {
        if (!store) return; // no provider: let the native post through
        const form = event.currentTarget;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(form);
        const intent =
          submitter?.getAttribute('value') ??
          String(data.get('intent') ?? '');
        if (!isCartFormIntent(intent)) return; // unknown: native post

        event.preventDefault();
        options.beforeSubmit?.();

        const field = (name: string): string | undefined => {
          const value = data.get(name);
          return typeof value === 'string' && value !== '' ? value : undefined;
        };
        const rawQuantity = field('quantity');

        const submission: CartSubmission = {
          intent: intent as CartFormIntent,
          ...(field('merchandiseId')
            ? {merchandiseId: field('merchandiseId')}
            : {}),
          ...(field('sellingPlanId')
            ? {sellingPlanId: field('sellingPlanId')}
            : {}),
          ...(rawQuantity != null ? {quantity: Number(rawQuantity)} : {}),
          ...(field('lineId') ? {lineId: field('lineId')} : {}),
          ...(field('discountCode')
            ? {discountCode: field('discountCode')}
            : {}),
          // The note is the one field whose empty string is meaningful.
          ...(intent === 'note-update'
            ? {note: String(data.get('note') ?? '')}
            : {}),
        };

        void store.submit(submission);
        options.afterSubmit?.();
      },
    }),
    [store],
  );

  const register = useCallback(
    (name: string, options: RegisterOptions = {}) =>
      isCartFormIntent(name)
        ? ({name: 'intent', value: name} as const)
        : ({
            name,
            ...(options.value !== undefined ? {value: options.value} : {}),
            ...(options.defaultValue !== undefined
              ? {defaultValue: options.defaultValue}
              : {}),
          } as const),
    [],
  );

  return {formProps, register};
}
