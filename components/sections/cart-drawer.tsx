'use client';
/**
 * Port of sections/cart-drawer.liquid (via the Hydrogen mirror) — the
 * slide-out cart drawer, mounted on every page by the overlay-group.
 * The Liquid theme drives it with the <cart-drawer> web component
 * (src/entries/cart.ts on top of <theme-dialog>, src/lib/dialog.ts);
 * here the same behavior lives in React on the optimistic cart store:
 *
 * - clicks on any `[data-dialog-open="CartDrawer"]` element open it
 *   (≙ registerDialogs — the header's cart link dispatches this and
 *   keeps its /cart href as the no-JS fallback),
 * - an add-to-cart opens it: the adapter's CartAddForm emits
 *   commerce-core's 'cart:updated' on submit (PDP buy buttons, card
 *   quick-add, quick-add dialog),
 * - `[data-dialog-close]` buttons / backdrop click / Esc close it,
 * - contents re-render from the store itself: mutations post to
 *   /api/cart, apply optimistically and reconcile with server truth
 *   (≙ the cart:updated section-HTML refresh) — pending lines render
 *   dimmed instead of behind a spinner.
 *
 * CSS: app/styles/components/sections-cart-drawer.css
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {Icon, imageUrl, t} from '@zalify/storefront-kit/react';
import {
  aggregateDiscountAllocations,
  formatMoney,
  on,
  type Money,
} from '@zalify/storefront-kit/commerce';
import {
  useCart,
  useCartForm,
  type CartState,
} from '~/components/cart/cart-context';
import {CartVoucher} from '~/components/theme/CartVoucher';

interface CartDrawerSettings {
  free_shipping_threshold?: number;
  recommendations_collection?: string;
  voucher_code?: string;
  voucher_text?: string;
  color_scheme?: string;
}

/** Loose cart line shape (Storefront API via the root layout — no codegen). */
interface CartLineData {
  id: string;
  quantity: number;
  discountAllocations?: Array<{
    code?: string | null;
    title?: string | null;
    discountedAmount?: {amount: string; currencyCode: string};
  }>;
  cost?: {
    totalAmount?: Money;
    amountPerQuantity?: Money;
    compareAtAmountPerQuantity?: Money | null;
  };
  merchandise?: {
    id?: string;
    title?: string;
    image?: {
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    } | null;
    product?: {handle?: string; title?: string};
    selectedOptions?: Array<{name: string; value: string}>;
  };
}

/** Mirror of Hydrogen's useVariantUrl — PDP link carrying the options. */
function lineUrl(line: CartLineData): string {
  const handle = line.merchandise?.product?.handle ?? '';
  const params = new URLSearchParams();
  for (const option of line.merchandise?.selectedOptions ?? []) {
    params.set(option.name, option.value);
  }
  const query = params.toString();
  return `/products/${handle}${query ? `?${query}` : ''}`;
}

/* Module-level so the selector identity is stable across renders. */
const selectLoading = (state: CartState) => state.loading;
const selectData = (state: CartState) => state.data;
const selectPendingLines = (state: CartState) => state.pending.lines;

export default function CartDrawerSection({
  id,
  settings,
}: SectionProps<CartDrawerSettings>) {
  const {
    free_shipping_threshold: freeShippingThreshold = 50,
    voucher_code: voucherCode,
    voucher_text: voucherText,
    color_scheme: colorScheme = 'scheme-1',
  } = settings;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // Count promised by the add that opened the drawer ('cart:updated'
  // payload): the mutation is still in flight at that moment, so the
  // store can report zero lines while an item is on its way — the
  // content uses this to suppress the "cart is empty" state (and the
  // voucher) until the line lands. Reset on close so a failed add
  // doesn't suppress the real empty state forever.
  const [expectedCount, setExpectedCount] = useState(0);
  // Cleared as soon as lines arrive (the expectation is fulfilled) —
  // otherwise removing the last line with the drawer still open would
  // keep suppressing the legit empty state.
  const clearExpectedCount = useCallback(() => setExpectedCount(0), []);
  const close = () => {
    setOpen(false);
    setExpectedCount(0);
  };
  const loading = useCart(selectLoading);

  // showModal()/close() driven by state — the React mirror of
  // ThemeDialog.show()/hide() (show() only when not already open).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // ≙ registerDialogs in src/lib/dialog.ts: any element anywhere with
  // data-dialog-open="CartDrawer" opens the drawer (the theme header's
  // cart link keeps its /cart href as the no-JS fallback — native
  // anchor navigation is cancelable for the whole dispatch, so this
  // bubble-phase preventDefault stops it).
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const opener = target?.closest<HTMLElement>('[data-dialog-open]');
      if (opener?.dataset.dialogOpen === 'CartDrawer') {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  // ≙ ProductForm in src/entries/cart.ts: add-to-cart shows the
  // drawer. The adapter's CartAddForm emits 'cart:updated' on submit
  // (PDP form, card quick-add, quick-add dialog) — the same event
  // closes the quick-add dialog first. The optimistic store already
  // shows the new count when the drawer opens.
  useEffect(
    () =>
      on('cart:updated', ({itemCount}) => {
        setExpectedCount(itemCount);
        setOpen(true);
      }),
    [],
  );

  return (
    <div id="CartDrawer" data-section-id={id}>
      <dialog
        ref={dialogRef}
        scroll-lock=""
        className={`drawer color-${colorScheme}`}
        aria-label={t('cart.title')}
        onClose={close}
        // Light dismiss: clicks land on the <dialog> itself only when
        // they hit the backdrop (mirror of ThemeDialog's click handler).
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <header className="drawer__header cluster">
          <h2 className="drawer__title">{t('cart.title')}</h2>
          <button
            type="button"
            className="drawer__close"
            data-dialog-close=""
            onClick={close}
            aria-label={t('general.close')}
          >
            <Icon name="icon-close" />
          </button>
        </header>

        {/* While the streamed bootstrap resolves the store reports
            loading — render the same empty shell the previous Suspense
            fallback produced. */}
        {loading ? (
          <div className="drawer__body cart-drawer__body" data-item-count="0" />
        ) : (
          <CartDrawerContent
            threshold={freeShippingThreshold}
            voucherCode={voucherCode}
            voucherText={voucherText}
            expectedCount={expectedCount}
            onLinesArrived={clearExpectedCount}
            onClose={close}
          />
        )}
      </dialog>
    </div>
  );
}

function CartDrawerContent({
  threshold,
  voucherCode,
  voucherText,
  expectedCount,
  onLinesArrived,
  onClose,
}: {
  threshold: number;
  voucherCode?: string;
  voucherText?: string;
  expectedCount: number;
  onLinesArrived: () => void;
  onClose: () => void;
}) {
  // The cart store: every mutation posts to /api/cart, applies
  // optimistically and reconciles — the Next mirror of Hydrogen's
  // useOptimisticCart re-render.
  const cart = useCart(selectData) as any;
  const lines: CartLineData[] = cart?.lines?.nodes ?? [];
  const itemCount: number = cart?.totalQuantity ?? 0;
  const total: Money | undefined = cart?.cost?.totalAmount;
  const totalAmount = Number(total?.amount ?? 0);
  const currencyCode = total?.currencyCode;
  // The add that opened the drawer is still in flight: no line data
  // yet, but an item is coming — render neither the lines nor the
  // "empty" state for that beat instead of lying.
  const addInFlight = lines.length === 0 && expectedCount > 0;
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (hasLines) onLinesArrived();
  }, [hasLines, onLinesArrived]);

  return (
    <>
      <div
        className="drawer__body cart-drawer__body"
        data-item-count={itemCount}
      >
        {threshold > 0 && currencyCode && (
          <div className="cart-drawer__shipping-bar">
            <p className="cart-drawer__shipping-message">
              {totalAmount >= threshold
                ? t('cart.free_shipping_unlocked')
                : t('cart.free_shipping_progress_html', {
                    remaining: formatMoney({
                      amount: (threshold - totalAmount).toFixed(2),
                      currencyCode,
                    }),
                  })}
            </p>
            <div className="cart-drawer__shipping-track" role="presentation">
              <span
                className="cart-drawer__shipping-fill"
                style={
                  {
                    '--progress': `${Math.min(100, Math.floor((totalAmount * 100) / threshold))}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        )}

        {lines.length === 0 ? (
          addInFlight ? null : (
          <div
            className="cart-drawer__empty stack"
            style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
          >
            <span className="cart-drawer__empty-icon">
              <Icon name="icon-cart" />
            </span>
            <p>{t('cart.empty')}</p>
            <Link
              href="/collections/all"
              className="button"
              data-dialog-close=""
              onClick={onClose}
            >
              {t('cart.continue_shopping')}
            </Link>
          </div>
          )
        ) : (
          <ul className="cart-drawer__lines stack" role="list">
            {lines.map((line, index) => (
              <CartDrawerLine
                key={line.id}
                line={line}
                index={index}
                onClose={onClose}
              />
            ))}
          </ul>
        )}

        {/* Rendered unconditionally, matching the Liquid source — the
            component outputs nothing without a code or items. */}
        <CartVoucher code={voucherCode} text={voucherText} cart={cart} />

        {lines.length > 0 && (
          <>
            <div
              className="cart-drawer__note stack"
              style={{'--stack-gap': 'var(--space-2xs)'} as React.CSSProperties}
            >
              <label className="cart-drawer__note-label" htmlFor="CartDrawerNote">
                {t('cart.note_label')}
              </label>
              <textarea
                id="CartDrawerNote"
                className="cart-drawer__note-input"
                name="note"
                rows={2}
                placeholder={t('cart.note_placeholder')}
                defaultValue={cart?.note ?? ''}
              />
            </div>

            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>{t('cart.subtotal')}</span>
                <span>{formatMoney(cart?.cost?.subtotalAmount)}</span>
              </div>
              {/* One summed row per code/title: the API returns one
                  allocation per line the discount applies to. */}
              {aggregateDiscountAllocations(cart?.discountAllocations).map(
                (discount) => (
                  <div className="cart-summary__row" key={discount.label}>
                    <span>{discount.label}</span>
                    <span>-{formatMoney(discount.amount)}</span>
                  </div>
                ),
              )}
              <div className="cart-summary__row cart-summary__row--muted">
                <span>{t('cart.tax_note')}</span>
                <span aria-hidden="true">{'—'}</span>
              </div>
              <div className="cart-summary__row cart-summary__row--muted">
                <span>
                  {t('cart.shipping')}
                  {threshold > 0 && currencyCode
                    ? ` (${t('cart.free_shipping_over', {
                        amount: formatMoney({
                          amount: String(threshold),
                          currencyCode,
                        }),
                      })})`
                    : null}
                </span>
                <span aria-hidden="true">{'—'}</span>
              </div>
            </div>

            <div
              className="cart-drawer__disclaimers stack"
              style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
            >
              <p>{t('cart.disclaimer_shipping')}</p>
              <p>{t('cart.disclaimer_tax')}</p>
            </div>
          </>
        )}
      </div>

      {lines.length > 0 && (
        <footer
          className="drawer__footer stack"
          style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
        >
          <div className="cluster cart-drawer__total">
            <span>{t('cart.estimated_total')}</span>
            <span>{formatMoney(total)}</span>
          </div>
          <a href={cart?.checkoutUrl} className="button cart-drawer__checkout">
            {t('cart.checkout')}
          </a>
        </footer>
      )}
    </>
  );
}

function CartDrawerLine({
  line,
  index,
  onClose,
}: {
  line: CartLineData;
  index: number;
  onClose: () => void;
}) {
  const {formProps, register} = useCartForm();
  const pendingLines = useCart(selectPendingLines);
  const pending = pendingLines.has(line.id);
  const merchandise = line.merchandise ?? {};
  const image = merchandise.image;
  const url = lineUrl(line);
  const finalLine = line.cost?.totalAmount;
  const compareUnit = line.cost?.compareAtAmountPerQuantity;
  const originalLine: Money | null = compareUnit
    ? {
        amount: (Number(compareUnit.amount) * line.quantity).toFixed(2),
        currencyCode: compareUnit.currencyCode,
      }
    : null;
  const onSale =
    !!originalLine &&
    !!finalLine &&
    Number(originalLine.amount) > Number(finalLine.amount);

  return (
    <li
      className="cart-drawer__line"
      style={pending ? {opacity: 0.5} : undefined}
    >
      {image?.url && (
        <div className="cart-drawer__media">
          <img
            src={imageUrl(image.url, 180)}
            srcSet={`${imageUrl(image.url, 90)} 90w, ${imageUrl(image.url, 180)} 180w`}
            loading="lazy"
            alt={image.altText ?? ''}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
          />
        </div>
      )}

      <div
        className="cart-drawer__details stack"
        style={{'--stack-gap': 'var(--space-2xs)'} as React.CSSProperties}
      >
        <Link className="cart-drawer__product-title" href={url} onClick={onClose}>
          {merchandise.product?.title}
        </Link>
        {merchandise.title !== 'Default Title' && (
          <p className="cart-drawer__variant">{merchandise.title}</p>
        )}
        <p className="cart-drawer__price">
          {onSale && (
            <s className="cart-drawer__price-compare">
              {formatMoney(originalLine)}
            </s>
          )}
          {formatMoney(finalLine)}
        </p>

        {(line.discountAllocations?.length ?? 0) > 0 && (
          <ul className="cart-drawer__discounts" role="list">
            {line.discountAllocations!.map((allocation: any, i: number) => (
              <li key={i}>
                {allocation.code ?? allocation.title}
                {' (-'}
                {formatMoney(allocation.discountedAmount)}
                {')'}
              </li>
            ))}
          </ul>
        )}

        <div className="cluster cart-drawer__line-actions">
          <QtyStepper line={line} index={index} />
          <form {...formProps()}>
            <input type="hidden" {...register('lineId', {value: line.id})} />
            <button
              {...register('remove')}
              type="submit"
              className="cart-drawer__remove"
              data-line={index + 1}
            >
              {t('cart.remove')}
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

/**
 * The theme's .qty-stepper on the cart form contract: −/+ are
 * intent=decrease/increase submit buttons and the input posts
 * intent=set on commit (native change / Enter, through the hidden
 * `set` default submitter). No debounce needed — the store resolves
 * the relative intents to an absolute target and aborts the
 * superseded in-flight mutation per line, so rapid clicks are safe
 * (mirroring onStep/#queueChange in src/entries/cart.ts). Shared with
 * the cart page, which passes its own inputId (the drawer is mounted
 * globally, so the default ids would collide there).
 */
export function QtyStepper({
  line,
  index,
  inputId,
}: {
  line: CartLineData;
  index: number;
  inputId?: string;
}) {
  const {formProps, register} = useCartForm();
  const formRef = useRef<HTMLFormElement>(null);
  const setRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Native change (commit) mirrors the Liquid `on:change` wiring —
  // React's onChange would fire per keystroke and remove lines while
  // the user is still typing. Commits submit *through* the hidden
  // `set` button: the intent comes from SubmitEvent.submitter, and a
  // bare requestSubmit() has none.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onChange = () => {
      if (setRef.current) formRef.current?.requestSubmit(setRef.current);
    };
    input.addEventListener('change', onChange);
    return () => input.removeEventListener('change', onChange);
  }, []);

  return (
    <form ref={formRef} {...formProps()}>
      <button {...register('set')} ref={setRef} type="submit" hidden />
      <input type="hidden" {...register('lineId', {value: line.id})} />
      <div className="qty-stepper">
        <button
          {...register('decrease')}
          type="submit"
          className="qty-stepper__button"
          data-step="-1"
          aria-label={t('cart.decrease')}
        >
          {'−'}
        </button>
        <label
          className="visually-hidden"
          htmlFor={inputId ?? `CartQuantity-${index + 1}`}
        >
          {t('cart.quantity')}
        </label>
        <input
          ref={inputRef}
          id={inputId ?? `CartQuantity-${index + 1}`}
          key={line.quantity}
          className="qty-stepper__input"
          {...register('quantity', {defaultValue: line.quantity})}
          type="number"
          min={0}
          data-line={index + 1}
        />
        <button
          {...register('increase')}
          type="submit"
          className="qty-stepper__button"
          data-step="1"
          aria-label={t('cart.increase')}
        >
          {'+'}
        </button>
      </div>
    </form>
  );
}
