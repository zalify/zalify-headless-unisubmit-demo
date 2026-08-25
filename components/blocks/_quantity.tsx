'use client';
/**
 * Port of blocks/_quantity.liquid (via the Hydrogen mirror) — quantity
 * stepper. The Liquid theme feeds the buy-buttons form via the form
 * attribute; here the quantity lives in the product section's shared
 * context, consumed by _buy-buttons and the sticky bar.
 * CSS: qty-stepper primitives in critical.css.
 */
import type {BlockProps} from '@zalify/storefront-kit/react';
import {t} from '@zalify/storefront-kit/react';
import {useProductQuantity} from '~/components/sections/product';

export default function QuantityBlock({sectionId}: BlockProps) {
  const {quantity, setQuantity} = useProductQuantity();
  const inputId = `Quantity-${sectionId}`;

  const clamp = (value: number) => Math.max(1, value || 1);

  return (
    <div
      className="product__quantity cluster"
      style={{'--cluster-gap': 'var(--space-sm)'} as React.CSSProperties}
    >
      <label className="product__quantity-label" htmlFor={inputId}>
        {t('products.quantity')}
      </label>
      <div className="qty-stepper">
        <button
          type="button"
          className="qty-stepper__button"
          onClick={() => setQuantity(clamp(quantity - 1))}
          aria-label={t('cart.decrease')}
        >
          &minus;
        </button>
        <input
          id={inputId}
          className="qty-stepper__input"
          type="number"
          name="quantity"
          value={quantity}
          min={1}
          inputMode="numeric"
          onChange={(event) => setQuantity(clamp(Number(event.target.value)))}
        />
        <button
          type="button"
          className="qty-stepper__button"
          onClick={() => setQuantity(clamp(quantity + 1))}
          aria-label={t('cart.increase')}
        >
          +
        </button>
      </div>
    </div>
  );
}
