'use client';
/**
 * Port of snippets/cart-voucher.liquid (via the Hydrogen mirror) — the
 * merchant-configured voucher as a dashed chip with a one-tap "Apply"
 * action. Once the code is on the cart (cart.discountCodes) it flips
 * to an "Applied" state. Applies through the cart form contract
 * (intent=discount-apply → /api/cart); the store applies the code
 * optimistically and tracks it in pending.discountCodes while the
 * mutation is in flight (≙ the theme's Ajax applyDiscount in
 * src/lib/cart.ts).
 *
 * Renders nothing when no code is configured or the cart is empty —
 * call it unconditionally, matching the Liquid snippet.
 * CSS: app/styles/components/snippets-cart-voucher.css
 */
import {t} from '@zalify/storefront-kit/react';
import {
  useCart,
  useCartForm,
  type CartState,
} from '~/components/cart/cart-context';

/** The slice of the cart the voucher needs (typed loosely per contract). */
export interface VoucherCart {
  totalQuantity?: number | null;
  discountCodes?: Array<{code: string; applicable: boolean}> | null;
  lines?: {nodes?: Array<unknown>} | null;
}

const selectPendingCodes = (state: CartState) => state.pending.discountCodes;

export function CartVoucher({
  code,
  text,
  cart,
}: {
  code?: string;
  text?: string;
  cart?: VoucherCart | null;
}) {
  // Hooks stay above the early return below.
  const {formProps, register} = useCartForm();
  const pendingCodes = useCart(selectPendingCodes);
  const voucherCode = (code ?? '').trim();
  // Gate on actual lines, not totalQuantity: during an add-in-flight
  // the count can be bumped (optimistically or via the event payload)
  // before any line data exists, and the voucher — possibly showing a
  // stale not-applicable error from the previously emptied cart —
  // must not pop over the empty state.
  const hasItems = (cart?.lines?.nodes?.length ?? 0) > 0;
  if (!voucherCode || !hasItems) return null;

  // Mirror of the snippet's applied_codes/discount_codes sweep: the
  // Storefront API's cart.discountCodes is the authoritative list.
  const discountCodes = cart?.discountCodes ?? [];
  const entry = discountCodes.find(
    (candidate) => candidate.code.toUpperCase() === voucherCode.toUpperCase(),
  );
  const applied = Boolean(entry?.applicable);
  const pending = pendingCodes.has(voucherCode);
  // Code is attached to the cart but not applicable — the state the
  // theme surfaces via cart.voucher_error after an Ajax apply. While
  // the optimistic apply is pending the code is already on the cart
  // but unconfirmed, so hold the error until the store settles.
  const failed = Boolean(entry) && !applied && !pending;
  const appliedCodes = discountCodes
    .filter((candidate) => candidate.applicable)
    .map((candidate) => candidate.code);

  return (
    <div className="cart-voucher">
      <div className="cart-voucher__row">
        <div className="cart-voucher__meta">
          <span className="cart-voucher__code">{voucherCode}</span>
          {text ? <p className="cart-voucher__text">{text}</p> : null}
        </div>

        {applied ? (
          <span className="cart-voucher__applied">
            <span aria-hidden="true">{'✓'}</span> {t('cart.voucher_applied')}
          </span>
        ) : (
          <form {...formProps()}>
            <input
              type="hidden"
              {...register('discountCode', {value: voucherCode})}
            />
            <button
              {...register('discount-apply')}
              type="submit"
              className="cart-voucher__apply"
              data-code={voucherCode}
              data-applied-codes={appliedCodes.join(',')}
              style={pending ? {opacity: 0.5} : undefined}
            >
              {t('cart.voucher_apply')}
            </button>
          </form>
        )}
      </div>

      {!applied ? (
        <p className="cart-voucher__error" hidden={!failed}>
          {t('cart.voucher_error')}
        </p>
      ) : null}
    </div>
  );
}
