'use client';
/**
 * Port of blocks/_variant-picker.liquid (via the Hydrogen mirror) —
 * variant options rendered as image thumbnails (for the media-group
 * option), swatches, or pills, plus the size-guide trigger. Option
 * selection writes the mapped option's variantUriQuery
 * (`?variant=<id>`) with native history.replaceState — a pure
 * client-side update: Next syncs useSearchParams from the History API
 * without a server round trip, so switching feels instant. The URL
 * stays the single source of truth for the selected variant — every
 * consumer derives it via useSelectedVariant, the pure replacement
 * for Hydrogen's useOptimisticVariant/getProductOptions. Only
 * combined-listing children (a different product URL) go through the
 * router.
 *
 * Simplifications: selling plans (purchase options) and the
 * swatch_color metaobject lookup need data the product query doesn't
 * provide.
 *
 * CSS: sections-product.css (variant-thumb/variant-option rules) +
 * global picker primitives in critical.css.
 */
import {useRouter} from 'next/navigation';
import type {BlockProps} from '@zalify/storefront-kit/react';
import {imageUrl, t, useResource} from '@zalify/storefront-kit/react';
import {getProductOptions, type ProductOptionValue} from '~/lib/product-options';
import {useSelectedVariant} from '~/components/use-selected-variant';
import {getMediaOption, hasOnlyDefaultVariant} from '~/components/sections/product';

/**
 * Mirror of snippets/swatch-style.liquid's vetted CSS color keywords:
 * only these may pass through as a swatch fill — an arbitrary name
 * would invalidate the whole background declaration.
 */
const CSS_COLORS = new Set(
  'aliceblue,antiquewhite,aqua,aquamarine,azure,beige,bisque,black,blanchedalmond,blue,blueviolet,brown,burlywood,cadetblue,chartreuse,chocolate,coral,cornflowerblue,cornsilk,crimson,cyan,darkblue,darkcyan,darkgoldenrod,darkgray,darkgreen,darkgrey,darkkhaki,darkmagenta,darkolivegreen,darkorange,darkorchid,darkred,darksalmon,darkseagreen,darkslateblue,darkslategray,darkslategrey,darkturquoise,darkviolet,deeppink,deepskyblue,dimgray,dimgrey,dodgerblue,firebrick,floralwhite,forestgreen,fuchsia,gainsboro,ghostwhite,gold,goldenrod,gray,green,greenyellow,grey,honeydew,hotpink,indianred,indigo,ivory,khaki,lavender,lavenderblush,lawngreen,lemonchiffon,lightblue,lightcoral,lightcyan,lightgoldenrodyellow,lightgray,lightgreen,lightgrey,lightpink,lightsalmon,lightseagreen,lightskyblue,lightslategray,lightslategrey,lightsteelblue,lightyellow,lime,limegreen,linen,magenta,maroon,mediumaquamarine,mediumblue,mediumorchid,mediumpurple,mediumseagreen,mediumslateblue,mediumspringgreen,mediumturquoise,mediumvioletred,midnightblue,mintcream,mistyrose,moccasin,navajowhite,navy,oldlace,olive,olivedrab,orange,orangered,orchid,palegoldenrod,palegreen,paleturquoise,palevioletred,papayawhip,peachpuff,peru,pink,plum,powderblue,purple,rebeccapurple,red,rosybrown,royalblue,saddlebrown,salmon,sandybrown,seagreen,seashell,sienna,silver,skyblue,slateblue,slategray,slategrey,snow,springgreen,steelblue,tan,teal,thistle,tomato,turquoise,violet,wheat,white,whitesmoke,yellow,yellowgreen'.split(
    ',',
  ),
);

/** Mirror of snippets/swatch-style.liquid (metaobject step omitted). */
function swatchStyle(value: any): React.CSSProperties | undefined {
  const swatch = value?.swatch;
  const swatchImage = swatch?.image?.previewImage?.url;
  if (swatchImage) {
    return {'--swatch': `url(${imageUrl(swatchImage, 100)})`} as React.CSSProperties;
  }
  if (swatch?.color) {
    return {'--swatch': swatch.color} as React.CSSProperties;
  }
  const probe = String(value?.name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]/g, '');
  if (CSS_COLORS.has(probe)) {
    return {'--swatch': probe} as React.CSSProperties;
  }
  return undefined;
}

function matchesNameList(optionNameDown: string, listKey: string): boolean {
  return t(listKey)
    .toLowerCase()
    .split(',')
    .some((name) => {
      const clean = name.trim();
      return clean !== '' && optionNameDown.includes(clean);
    });
}

export default function VariantPickerBlock({sectionId}: BlockProps) {
  const router = useRouter();
  const product = useResource<any>('product');
  const selectedVariant = useSelectedVariant(product);

  if (!product) return null;

  // Nothing to pick for single-variant products (selling plans, which
  // would also keep the picker, aren't queried)
  if (hasOnlyDefaultVariant(product)) return <div hidden />;

  const productOptions = getProductOptions(product, selectedVariant);
  const mediaOption = getMediaOption(product);

  const openSizeGuide = () => {
    document
      .getElementById(`SizeGuide-${sectionId}`)
      ?.querySelector('dialog')
      ?.showModal();
  };

  const selectValue = (value: ProductOptionValue) => {
    if (value.selected) return;
    if (value.isDifferentProduct) {
      // Combined listing child product: a different URL entirely —
      // a real navigation through the router.
      router.replace(`/products/${value.handle}?${value.variantUriQuery}`, {
        scroll: false,
      });
    } else {
      // Same product: shallow URL update. Next keeps useSearchParams
      // in sync with the History API, so every useSelectedVariant
      // consumer re-derives instantly — no RSC round trip.
      window.history.replaceState(null, '', `?${value.variantUriQuery}`);
    }
  };

  return (
    <div
      className="stack"
      style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
    >
      <div
        className="product__options stack"
        style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
      >
        {productOptions.map((option, optIndex) => {
          const imageMode = mediaOption?.index === optIndex;
          const optionNameDown = String(option.name).toLowerCase();

          // Swatch mode: native swatch data, or an option named like a
          // color (products.color_option_match)
          const swatchMode =
            !imageMode &&
            (Boolean(option.optionValues[0]?.swatch) ||
              matchesNameList(optionNameDown, 'products.color_option_match'));

          const optionIsSize = matchesNameList(
            optionNameDown,
            'products.size_option_match',
          );

          const selectedValue =
            option.optionValues.find((value) => value.selected)?.name ?? '';

          return (
            <fieldset
              key={option.name}
              className="variant-option"
              data-option=""
              // Nothing to choose — hidden like the Liquid picker, which
              // must keep the fieldset for positional variant matching
              hidden={option.optionValues.length === 1}
              data-media-filter={imageMode ? '' : undefined}
            >
              <legend className="variant-option__name">
                {option.name}{' '}
                <span className="variant-option__selected" data-selected-value>
                  {selectedValue}
                </span>
                {optionIsSize ? (
                  <button
                    type="button"
                    className="variant-option__guide"
                    onClick={openSizeGuide}
                  >
                    {t('products.size_guide')}
                  </button>
                ) : null}
              </legend>
              <div
                className={`cluster${swatchMode ? ' variant-option__values--swatches' : ''}`}
                style={{'--cluster-gap': 'var(--space-xs)'} as React.CSSProperties}
              >
                {option.optionValues.map((value) => {
                  const valueVariant = value.firstSelectableVariant;
                  return (
                    <label key={value.name} className="variant-option__value">
                      <input
                        className="visually-hidden"
                        type="radio"
                        name={`option-${sectionId}-${optIndex + 1}`}
                        value={value.name}
                        checked={Boolean(value.selected)}
                        // Values that resolve to a sold-out/nonexistent
                        // variant stay clickable — the buy button
                        // communicates "sold out"
                        data-unavailable={value.available ? undefined : ''}
                        onChange={() => selectValue(value)}
                      />
                      {imageMode ? (
                        <>
                          <span className="variant-thumb" title={value.name}>
                            {valueVariant?.image?.url ? (
                              <img
                                src={imageUrl(valueVariant.image.url, 160)}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="variant-thumb__fallback">
                                {String(value.name).slice(0, 2)}
                              </span>
                            )}
                          </span>
                          <span className="visually-hidden">{value.name}</span>
                        </>
                      ) : swatchMode ? (
                        <>
                          <span
                            className="swatch"
                            title={value.name}
                            style={swatchStyle(value)}
                          />
                          <span className="visually-hidden">{value.name}</span>
                        </>
                      ) : (
                        <span className="variant-option__pill">{value.name}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
