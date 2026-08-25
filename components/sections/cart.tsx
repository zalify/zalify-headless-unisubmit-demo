'use client';
/**
 * Port of sections/cart.liquid (via the Hydrogen mirror) — the full
 * /cart page, driven by the optimistic cart store
 * (components/cart/cart-context.tsx). Each mutation is its own form
 * speaking the cart form contract (formProps() + register()):
 * quantity changes apply on commit (native change event) as an
 * intent=set POST to /api/cart, applied optimistically and reconciled
 * with server truth — no server round-trip re-render needed, and the
 * separate "Update" button stays unnecessary.
 *
 * The forms stay valid no-JS posts: /api/cart answers non-fetch form
 * submissions with a redirect back to this page.
 *
 * While the store is loading (the layout's streamed bootstrap hasn't
 * resolved yet) only the heading renders — the same static shell the
 * previous Suspense fallback produced. Values whose line is pending
 * render dimmed, never behind a spinner.
 * CSS: app/styles/components/sections-cart.css
 */
import {useEffect, useRef} from 'react';
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {Icon, imageUrl, t} from '@zalify/storefront-kit/react';
import {
  aggregateDiscountAllocations,
  formatMoney,
  type Money,
} from '@zalify/storefront-kit/commerce';
import {
  useCart,
  useCartForm,
  type CartState,
} from '~/components/cart/cart-context';
import {CartVoucher} from '~/components/theme/CartVoucher';
import {QtyStepper} from '~/components/sections/cart-drawer';

interface CartSettings {
  voucher_code?: string;
  voucher_text?: string;
  color_scheme?: string;
  section_spacing?: 'none' | 'sm' | 'md' | 'lg';
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
const selectPendingNote = (state: CartState) => state.pending.note;

export default function CartSection({settings}: SectionProps<CartSettings>) {
  const {
    color_scheme: colorScheme = 'scheme-1',
    section_spacing: sectionSpacing = 'md',
  } = settings;
  const loading = useCart(selectLoading);

  return (
    <div
      className={`cart-page section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${sectionSpacing})`,
        } as React.CSSProperties
      }
    >
      {/* min-height reserves room for the client-rendered cart (the
          store resolves after hydration) so the empty/loaded states
          don't shift the footer — CLS stays at 0 while loading. */}
      <div
        className="cart-page__inner stack"
        style={
          {
            '--stack-gap': 'var(--space-lg)',
            minHeight: 'max(60vh, 26rem)',
          } as React.CSSProperties
        }
      >
        {loading ? (
          <h1 className="cart-page__heading">{t('cart.title')}</h1>
        ) : (
          <CartPageContent settings={settings} />
        )}
      </div>
    </div>
  );
}

function CartPageContent({settings}: {settings: CartSettings}) {
  const {voucher_code: voucherCode, voucher_text: voucherText} = settings;
  const cart = useCart(selectData) as any;

  const lines: CartLineData[] = cart?.lines?.nodes ?? [];
  const itemCount: number = cart?.totalQuantity ?? 0;

  return (
    <>
      <h1 className="cart-page__heading">
        {t('cart.title')}
        {itemCount > 0 && (
          <span className="cart-page__count">
            {t(itemCount === 1 ? 'facets.items.one' : 'facets.items.other', {
              count: itemCount,
            })}
          </span>
        )}
      </h1>

      {lines.length === 0 ? (
          <div
            className="cart-page__empty stack"
            style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
          >
            <span className="cart-page__empty-icon">
              <Icon name="icon-cart" />
            </span>
            <p>{t('cart.empty')}</p>
            <Link href="/collections/all" className="button">
              {t('cart.continue_shopping')}
            </Link>
          </div>
        ) : (
          <div className="cart-page__form">
            <ul className="cart-page__lines" role="list">
              {lines.map((line, index) => (
                <CartPageLine key={line.id} line={line} index={index} />
              ))}
            </ul>

            <aside
              className="cart-page__summary stack"
              style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
            >
              <NoteField note={cart?.note ?? ''} />

              <CartVoucher code={voucherCode} text={voucherText} cart={cart} />

              <div className="cart-page__row">
                <span>{t('cart.subtotal')}</span>
                <span>{formatMoney(cart?.cost?.subtotalAmount)}</span>
              </div>
              {/* One summed row per code/title: the API returns one
                  allocation per line the discount applies to. */}
              {aggregateDiscountAllocations(cart?.discountAllocations).map(
                (discount) => (
                  <div className="cart-page__row" key={discount.label}>
                    <span>{discount.label}</span>
                    <span>-{formatMoney(discount.amount)}</span>
                  </div>
                ),
              )}
              <div className="cart-page__row cart-page__row--muted">
                <span>{t('cart.tax_note')}</span>
                <span aria-hidden="true">{'—'}</span>
              </div>
              <div className="cart-page__row cart-page__row--total">
                <span>{t('cart.estimated_total')}</span>
                <span>{formatMoney(cart?.cost?.totalAmount)}</span>
              </div>
              <p className="cart-page__note">{t('cart.note')}</p>
              <a href={cart?.checkoutUrl} className="button">
                {t('cart.checkout')}
              </a>
            </aside>
          </div>
        )}
    </>
  );
}

/**
 * Order note — applies on commit (native change), like the theme
 * field. Submits *through* the hidden intent button: the intent comes
 * from SubmitEvent.submitter, and a bare requestSubmit() has none.
 */
function NoteField({note}: {note: string}) {
  const {formProps, register} = useCartForm();
  const formRef = useRef<HTMLFormElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const pending = useCart(selectPendingNote);

  return (
    <form ref={formRef} {...formProps()} className="stack">
      <button {...register('note-update')} ref={saveRef} type="submit" hidden />
      <label className="cart-page__note-label" htmlFor="CartNote">
        {t('cart.note_label')}
      </label>
      <textarea
        id="CartNote"
        className="cart-page__note-input"
        rows={2}
        placeholder={t('cart.note_placeholder')}
        style={pending ? {opacity: 0.5} : undefined}
        {...register('note', {defaultValue: note})}
        onBlur={(event) => {
          if (event.currentTarget.value !== note && saveRef.current) {
            formRef.current?.requestSubmit(saveRef.current);
          }
        }}
      />
    </form>
  );
}

function CartPageLine({line, index}: {line: CartLineData; index: number}) {
  const {formProps, register} = useCartForm();
  const removeRef = useRef<HTMLButtonElement>(null);
  const pendingLines = useCart(selectPendingLines);
  const pending = pendingLines.has(line.id);
  const merchandise = line.merchandise ?? {};
  const image = merchandise.image;
  const url = lineUrl(line);
  const unitPrice = line.cost?.amountPerQuantity;
  const compareUnit = line.cost?.compareAtAmountPerQuantity;
  const onSale =
    !!unitPrice &&
    !!compareUnit &&
    Number(compareUnit.amount) > Number(unitPrice.amount);

  return (
    <li className="cart-page__line" style={pending ? {opacity: 0.5} : undefined}>
      {image?.url && (
        <Link href={url} className="cart-page__media">
          <img
            src={imageUrl(image.url, 240)}
            srcSet={`${imageUrl(image.url, 120)} 120w, ${imageUrl(image.url, 240)} 240w`}
            loading="lazy"
            alt={image.altText ?? ''}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
          />
        </Link>
      )}

      <div
        className="cart-page__details stack"
        style={{'--stack-gap': 'var(--space-2xs)'} as React.CSSProperties}
      >
        <Link className="cart-page__title" href={url}>
          {merchandise.product?.title}
        </Link>
        {merchandise.title !== 'Default Title' && (
          <p className="cart-page__variant">{merchandise.title}</p>
        )}
        <p className="cart-page__unit-price">
          {onSale && (
            <s className="cart-page__price-compare">{formatMoney(compareUnit)}</s>
          )}
          {formatMoney(unitPrice)}
        </p>
        {(line.discountAllocations?.length ?? 0) > 0 && (
          <ul className="cart-page__discounts" role="list">
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
        {/* item.url_to_remove ≙ an intent=remove cart form; the anchor
            keeps the theme's link styling and degrades to a /cart
            visit. The anchor activates the hidden intent button — the
            intent comes from SubmitEvent.submitter, and a bare
            requestSubmit() has none. */}
        <form {...formProps()}>
          <button {...register('remove')} ref={removeRef} type="submit" hidden />
          <input type="hidden" {...register('lineId', {value: line.id})} />
          <a
            className="cart-page__remove"
            href="/cart"
            onClick={(event) => {
              event.preventDefault();
              removeRef.current?.click();
            }}
          >
            {t('cart.remove')}
          </a>
        </form>
      </div>

      <div className="cart-page__line-end">
        <p className="cart-page__price">{formatMoney(line.cost?.totalAmount)}</p>
        {/* Drawer-parity stepper (shared component); the page's own
            input ids avoid colliding with the globally-mounted drawer. */}
        <QtyStepper line={line} index={index} inputId={`Updates-${index + 1}`} />
      </div>
    </li>
  );
}
