'use client';
/**
 * The Next.js implementation of ui-react's ThemeAdapter — the seam
 * through which shared components reach the router and the cart:
 *
 * - Link            → next/link (to → href; prefetch hint mapped through)
 * - useNavigate     → next/navigation router.push/replace
 *                     (preventScrollReset → {scroll: false})
 * - useSearchParams → a plain URLSearchParams copy of next's
 * - usePathname     → next/navigation
 * - CartAddForm     → the cart form contract (useCartForm): a POST to
 *                     /api/cart with intent=add, applied optimistically
 *                     by the cart store. Emits commerce-core's
 *                     'cart:updated' on submit — the theme event that
 *                     opens the cart drawer.
 */
import {useCallback, useState} from 'react';
import Link from 'next/link';
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import type {
  AdapterLinkProps,
  CartAddFormProps,
  ThemeAdapter,
} from '@zalify/storefront-kit/react';
import {emit} from '@zalify/storefront-kit/commerce';
import {useCart, useCartForm} from '~/components/cart/cart-context';

function AdapterLink({to, prefetch, replace, ...rest}: AdapterLinkProps) {
  return (
    <Link
      href={to}
      // next/link prefetches viewport links by default; the theme's
      // `prefetch` flag is an on-intent hint, so only pass an explicit
      // opt-out through.
      prefetch={prefetch === false ? false : undefined}
      replace={replace}
      {...(rest as Record<string, unknown>)}
    />
  );
}

function useNavigate() {
  const router = useRouter();
  return useCallback(
    (
      url: string,
      opts?: {replace?: boolean; preventScrollReset?: boolean},
    ): void => {
      const options = {scroll: !opts?.preventScrollReset};
      if (opts?.replace) router.replace(url, options);
      else router.push(url, options);
    },
    [router],
  );
}

function useSearchParams(): URLSearchParams {
  const params = useNextSearchParams();
  return new URLSearchParams(params.toString());
}

const selectError = (state: {error: string | null}) => state.error;

/**
 * Add-to-cart through the cart form contract: hidden intent /
 * merchandiseId / quantity fields make the form a valid no-JS POST to
 * /api/cart; hydrated, formProps() routes the submit through the cart
 * store (optimistic count, per-entity aborts, rollback on failure).
 * The theme's add sites all pass a single line.
 *
 * `submitting` flips only for the synchronous dispatch: the store's
 * optimistic model keeps controls interactive instead of pending-
 * disabling them, so buttons re-enable immediately.
 */
export function CartAddForm({lines, children}: CartAddFormProps) {
  const {formProps, register} = useCartForm();
  const [submitting, setSubmitting] = useState(false);
  // The last cart error, surfaced where the shopper acted. The store
  // clears it on the next successful mutation.
  const error = useCart(selectError);
  const line = lines[0];
  const quantity = line?.quantity ?? 1;

  return (
    <form
      {...formProps({
        beforeSubmit: () => setSubmitting(true),
        afterSubmit: () => {
          setSubmitting(false);
          // The theme contract every storefront implementation speaks;
          // opens the cart drawer (and closes the quick-add dialog).
          // Best-effort count: the store's optimistic reconcile is the
          // truth and no listener reads the payload.
          emit('cart:updated', {itemCount: quantity});
        },
      })}
    >
      <input type="hidden" {...register('add')} />
      <input
        type="hidden"
        {...register('merchandiseId', {value: line?.merchandiseId ?? ''})}
      />
      <input type="hidden" {...register('quantity', {value: quantity})} />
      {error ? (
        <div className="form__message form__message--error" role="alert">
          {error}
        </div>
      ) : null}
      {children({submitting})}
    </form>
  );
}

export const nextAdapter: ThemeAdapter = {
  Link: AdapterLink,
  useNavigate,
  useSearchParams,
  usePathname,
  CartAddForm,
};
