'use client';
/**
 * Port of blocks/_title.liquid (via the Hydrogen mirror) — product
 * title, live-updating price, and badge chips as one tight cluster at
 * the top of the info column. Badge chips mirror
 * snippets/product-badges.liquid (status badge + badge:<Label> tags
 * matched against the theme's badge style settings; the badge_style
 * metaobject lookup has no client-side equivalent).
 * CSS: app/styles/components/blocks-_title.css (+ snippets-price.css,
 * snippets-product-badges.css)
 */
import type {BlockProps} from '@zalify/storefront-kit/react';
import {t, themeSettings, useResource} from '@zalify/storefront-kit/react';
import {formatMoney, isOnSale} from '@zalify/storefront-kit/commerce';
import {useSelectedVariant} from '~/components/use-selected-variant';

interface TitleSettings {
  show_badges?: boolean;
  show_rating?: boolean;
}

function labelList(value: unknown): string[] {
  return String(value ?? '')
    .toLowerCase()
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

/** Mirror of snippets/product-badges.liquid (settings slots only). */
function ProductBadges({product, variant}: {product: any; variant: any}) {
  const tags: string[] = product.tags ?? [];
  const tagsFlat = tags.join(',').toLowerCase().replace(/[-\s]/g, '');
  const isBestseller = tagsFlat.includes('bestseller');
  // product.available in Liquid is product-level; approximated with the
  // selected variant when the product-level field isn't queried.
  const available: boolean =
    (product.availableForSale as boolean | undefined) ??
    Boolean(variant?.availableForSale);
  const onSale = isOnSale(variant?.price, variant?.compareAtPrice);

  const style1 = labelList(themeSettings.badge_style_1_labels);
  const style2 = labelList(themeSettings.badge_style_2_labels);

  const chips: React.ReactNode[] = [];
  if (!available) {
    chips.push(
      <span key="status" className="badge">
        {t('products.sold_out')}
      </span>,
    );
  } else if (onSale) {
    chips.push(
      <span key="status" className="badge badge--sale">
        {t('products.sale')}
      </span>,
    );
  } else if (isBestseller) {
    chips.push(
      <span key="status" className="badge">
        {t('products.best_seller')}
      </span>,
    );
  }

  for (const tag of tags) {
    if (tag.slice(0, 6).toLowerCase() !== 'badge:') continue;
    const label = tag.slice(6).trim();
    const labelDown = label.toLowerCase();
    let styleClass = '';
    if (style1.includes(labelDown)) styleClass = ' badge--style-1';
    else if (style2.includes(labelDown)) styleClass = ' badge--style-2';
    chips.push(
      <span key={tag} className={`badge${styleClass}`}>
        {label}
      </span>,
    );
  }

  if (!chips.length) return null;
  return <div className="product__badges">{chips}</div>;
}

export default function TitleBlock({settings}: BlockProps<TitleSettings>) {
  const {show_badges: showBadges = true} = settings;
  // show_rating: the reviews.rating metafields aren't part of the
  // product query — the rating snippet has no data to render.

  const product = useResource<any>('product');
  const variant = useSelectedVariant(product);

  if (!product) return null;

  const onSale = isOnSale(variant?.price, variant?.compareAtPrice);

  return (
    <div
      className="stack"
      style={{'--stack-gap': 'var(--space-xs)'} as React.CSSProperties}
    >
      {showBadges ? <ProductBadges product={product} variant={variant} /> : null}
      <h1 className="product__title">{product.title}</h1>
      <div className="product__price">
        <span className={`price${onSale ? ' price--sale' : ''}`}>
          <span className="price__current">{formatMoney(variant?.price)}</span>
          {onSale ? (
            <s className="price__compare">{formatMoney(variant?.compareAtPrice)}</s>
          ) : (
            <s className="price__compare" hidden />
          )}
          {variant?.unitPrice ? (
            <span className="price__unit" data-unit-price>
              <span className="visually-hidden">
                {t('products.unit_price_label')}
              </span>
              <span data-unit-price-value>{formatMoney(variant.unitPrice)}</span>
            </span>
          ) : (
            <span className="price__unit" data-unit-price hidden />
          )}
        </span>
      </div>
    </div>
  );
}
