'use client';
/**
 * Port of sections/quick-add.liquid (via the Hydrogen mirror) —
 * quick-add dialog contents. Never placed in a template: the Liquid
 * theme fetches it via the Section Rendering API and injects it into
 * the quick-add <dialog>; here <QuickAddDialog/> renders <QuickAdd/>
 * directly with the card's product data (delivered by commerce-core's
 * 'quick-add:open' event). Variant resolution mirrors the theme's
 * product-info island (src/entries/product.ts) as React state.
 *
 * Add-to-bag goes through the adapter's CartAddForm (an intent=add
 * POST to /api/cart), which emits 'cart:updated' on submit — closing
 * the quick-add dialog and opening the cart drawer.
 *
 * Layout styles live in snippets/quick-add-dialog.liquid's stylesheet
 * (extracted to app/styles/components/snippets-quick-add-dialog.css).
 */
import {useState} from 'react';
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {Price, imageUrl, swatchStyle, t, useResource} from '@zalify/storefront-kit/react';
import type {CardOption, CardProduct, CardVariant} from '@zalify/storefront-kit/commerce';
import {
  formatMoney,
  hasOnlyDefaultVariant,
  optionValueOf,
  productUrl,
} from '@zalify/storefront-kit/commerce';
import {CartAddForm} from '~/lib/theme-adapter';

/**
 * Media-group option: the first option whose values map to variants
 * with distinct featured images renders as image thumbnails — same
 * rule as blocks/_variant-picker.liquid, so the quick-add picker
 * matches the PDP and the card strip.
 */
function mediaOptionName(
  options: CardOption[],
  variants: CardVariant[],
): string | null {
  for (const option of options) {
    const mediaIds: string[] = [];
    for (const value of option.optionValues) {
      const first = variants.find(
        (variant) => optionValueOf(variant, option.name) === value.name,
      );
      if (first?.image) mediaIds.push(first.image.id ?? first.image.url);
    }
    if (new Set(mediaIds).size > 1) return option.name;
  }
  return null;
}

/**
 * Swatch mode mirrors the PDP variant picker: native swatch data, or
 * an option named like a color — swatchStyle then resolves via CSS
 * color names.
 */
function isSwatchOption(option: CardOption): boolean {
  if (option.optionValues[0]?.swatch) return true;
  const optionNameDown = option.name.toLowerCase();
  return t('products.color_option_match')
    .toLowerCase()
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .some((name) => optionNameDown.includes(name));
}

function SubmitButton({
  submitting,
  variant,
}: {
  submitting: boolean;
  variant: CardVariant | undefined;
}) {
  const available = variant?.availableForSale === true;
  const label = !variant
    ? t('products.unavailable')
    : available
      ? t('products.add_to_bag')
      : t('products.sold_out');
  return (
    <button
      type="submit"
      className="button quick-add__submit"
      data-add-label={t('products.add_to_bag')}
      data-sold-out-label={t('products.sold_out')}
      data-unavailable-label={t('products.unavailable')}
      disabled={!available || submitting}
    >
      <span data-label="">{label}</span>
      <span data-price="" hidden={!available}>
        {available ? formatMoney(variant?.price) : ''}
      </span>
    </button>
  );
}

export function QuickAdd({
  product,
  sectionId = 'quick-add',
}: {
  product: CardProduct;
  sectionId?: string;
}) {
  const options = product.options ?? [];
  const variants = product.variants?.nodes ?? [];
  const initialVariant = product.selectedOrFirstAvailableVariant ?? null;
  const onlyDefault = hasOnlyDefaultVariant(product);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const option of options) {
      initial[option.name] =
        (initialVariant && optionValueOf(initialVariant, option.name)) ??
        option.optionValues[0]?.name ??
        '';
    }
    return initial;
  });

  const findVariant = (
    candidate: Record<string, string>,
  ): CardVariant | undefined =>
    variants.find((variant) =>
      options.every(
        (option) =>
          optionValueOf(variant, option.name) === candidate[option.name],
      ),
    );

  const currentVariant = onlyDefault
    ? (initialVariant ?? undefined)
    : findVariant(selected);
  // Price sticks to the last resolvable variant while an unavailable
  // combination is selected, matching the island's behavior.
  const displayVariant = currentVariant ?? initialVariant ?? undefined;
  const mediaOption = mediaOptionName(options, variants);
  const url = productUrl(product);

  return (
    <div className="quick-add">
      <div className="quick-add__intro">
        {product.featuredImage ? (
          <div className="quick-add__media">
            <img
              src={imageUrl(product.featuredImage.url, 200)}
              loading="lazy"
              alt={product.featuredImage.altText ?? ''}
            />
          </div>
        ) : null}
        <div
          className="stack"
          style={{'--stack-gap': 'var(--space-2xs)'} as React.CSSProperties}
        >
          <Link className="quick-add__title" href={url}>
            {product.title}
          </Link>
          <div>
            <Price
              price={displayVariant?.price}
              compareAt={displayVariant?.compareAtPrice}
              keepComparePlaceholder
              unitPrice={displayVariant?.unitPrice}
              unitPriceMeasurement={displayVariant?.unitPriceMeasurement}
              keepUnitPlaceholder
            />
          </div>
        </div>
      </div>

      {!onlyDefault ? (
        <div
          className="quick-add__options stack"
          style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
        >
          {options.map((option, optionIndex) => {
            const imageMode = option.name === mediaOption;
            const swatchMode = !imageMode && isSwatchOption(option);
            return (
              <fieldset
                key={option.name}
                className="variant-option"
                data-option=""
                // Nothing to choose — hidden, mirroring the Liquid picker
                hidden={option.optionValues.length === 1}
              >
                <legend className="variant-option__name">
                  {option.name}{' '}
                  <span
                    className="variant-option__selected"
                    data-selected-value=""
                  >
                    {selected[option.name]}
                  </span>
                </legend>
                <div
                  className={`cluster${
                    swatchMode ? ' variant-option__values--swatches' : ''
                  }`}
                  style={
                    {'--cluster-gap': 'var(--space-xs)'} as React.CSSProperties
                  }
                >
                  {option.optionValues.map((value) => {
                    // Mark values that would resolve to a sold-out (or
                    // nonexistent) variant, keeping the other options'
                    // current picks — they stay clickable, the buy
                    // button communicates "sold out".
                    const candidate = {
                      ...selected,
                      [option.name]: value.name,
                    };
                    const candidateVariant = findVariant(candidate);
                    const unavailable =
                      candidateVariant?.availableForSale !== true;
                    const valueVariant = variants.find(
                      (variant) =>
                        optionValueOf(variant, option.name) === value.name,
                    );
                    return (
                      <label
                        key={value.name}
                        className="variant-option__value"
                      >
                        <input
                          className="visually-hidden"
                          type="radio"
                          name={`quick-${sectionId}-${optionIndex + 1}`}
                          value={value.name}
                          checked={selected[option.name] === value.name}
                          onChange={() => setSelected(candidate)}
                          {...(unavailable ? {'data-unavailable': ''} : {})}
                        />
                        {imageMode ? (
                          <>
                            <span className="variant-thumb" title={value.name}>
                              {valueVariant?.image ? (
                                <img
                                  src={imageUrl(valueVariant.image.url, 160)}
                                  loading="lazy"
                                  alt={valueVariant.image.altText ?? ''}
                                />
                              ) : (
                                <span className="variant-thumb__fallback">
                                  {value.name.slice(0, 2)}
                                </span>
                              )}
                            </span>
                            <span className="visually-hidden">
                              {value.name}
                            </span>
                          </>
                        ) : swatchMode ? (
                          <>
                            <span
                              className="swatch"
                              title={value.name}
                              style={swatchStyle(value.name, value.swatch)}
                            ></span>
                            <span className="visually-hidden">
                              {value.name}
                            </span>
                          </>
                        ) : (
                          <span className="variant-option__pill">
                            {value.name}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : null}

      <CartAddForm
        lines={[
          {
            merchandiseId: currentVariant?.id ?? '',
            quantity: 1,
          },
        ]}
      >
        {({submitting}) => (
          <SubmitButton submitting={submitting} variant={currentVariant} />
        )}
      </CartAddForm>
    </div>
  );
}

/**
 * Section entry (registered in lib/theme-setup.ts). The Liquid section
 * is never placed in a template, but if it ever renders through the
 * engine it uses the route's product resource — the mirror of the
 * Section Rendering API request `{{ product.url }}?section_id=quick-add`.
 */
export default function QuickAddSection({id}: SectionProps) {
  const product = useResource('product') as CardProduct | undefined;
  if (!product) return null;
  return <QuickAdd product={product} sectionId={id} />;
}
