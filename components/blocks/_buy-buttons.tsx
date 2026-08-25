'use client';
/**
 * Port of blocks/_buy-buttons.liquid (via the Hydrogen mirror) — the
 * purchase cluster: the product form with the add-to-bag button
 * showing a live price × quantity. Add-to-cart goes through the
 * adapter's CartAddForm — an intent=add POST to /api/cart applied
 * optimistically by the cart store (the mirror of the theme's
 * <product-form> ajax submit); errors render inside the form
 * (CartAddForm's role="alert" message).
 *
 * Simplifications (data the product query doesn't provide): gift-card
 * recipient fields (isGiftCard), dynamic checkout / payment terms
 * (checkout-only), and store pickup availability
 * (variant.storeAvailability). Payment icons render the kit's fixed
 * default set — `shop.enabled_payment_types` isn't in the Storefront
 * API.
 *
 * CSS: buy-buttons rules in sections-product.css.
 */
import type {BlockProps} from '@zalify/storefront-kit/react';
import {PaymentIcons, t, useResource} from '@zalify/storefront-kit/react';
import {formatMoney} from '@zalify/storefront-kit/commerce';
import {CartAddForm} from '~/lib/theme-adapter';
import {useSelectedVariant} from '~/components/use-selected-variant';
import {multiplyMoney, useProductQuantity} from '~/components/sections/product';

interface BuyButtonsSettings {
  show_dynamic_checkout?: boolean;
  show_payment_icons?: boolean;
}

export default function BuyButtonsBlock({
  settings,
}: BlockProps<BuyButtonsSettings>) {
  const {show_payment_icons: showPaymentIcons = true} = settings;
  const product = useResource<any>('product');
  const selectedVariant = useSelectedVariant(product);
  const {quantity} = useProductQuantity();

  if (!product) return null;

  const available: boolean = Boolean(selectedVariant?.availableForSale);
  const lines = selectedVariant
    ? [{merchandiseId: selectedVariant.id as string, quantity}]
    : [];

  return (
    <div
      className="stack"
      style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
    >
      <div className="product__form stack" data-type="add-to-cart-form">
        <div
          className="buy-buttons stack"
          style={{'--stack-gap': 'var(--space-xs)'} as React.CSSProperties}
        >
          <CartAddForm lines={lines}>
            {({submitting}) => (
              <button
                type="submit"
                className="button buy-buttons__submit"
                disabled={!available || submitting}
              >
                <span data-label>
                  {selectedVariant
                    ? available
                      ? t('products.add_to_bag')
                      : t('products.sold_out')
                    : t('products.unavailable')}
                </span>
                {available && selectedVariant?.price ? (
                  <span className="buy-buttons__price" data-price>
                    {formatMoney(multiplyMoney(selectedVariant.price, quantity))}
                  </span>
                ) : null}
              </button>
            )}
          </CartAddForm>
        </div>
      </div>
      {showPaymentIcons && <PaymentIcons />}
    </div>
  );
}
