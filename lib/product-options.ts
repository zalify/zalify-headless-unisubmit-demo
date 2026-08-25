/**
 * Pure variant-selection logic for the product page — the Next.js
 * replacement for @shopify/hydrogen's useOptimisticVariant /
 * getAdjacentAndFirstAvailableVariants / getProductOptions. The URL
 * stays the single source of truth for the selection, canonically as
 * `?variant=<numeric id>` — the same deep-link format the Liquid
 * online store and ui-react's ProductCard swatch links use, so PLP
 * links land on the right variant. Legacy `OptionName=Value` pairs
 * (older shared links, cart line URLs) still resolve as a fallback.
 * Everything is computed per render from the product data the
 * PRODUCT_QUERY already ships (variants list + options[]
 * .optionValues[].firstSelectableVariant + adjacentVariants +
 * selectedOrFirst…). Pure TS — runs on the server (PDP initial
 * render) and the client (instant switches) alike.
 */
import {numericId} from '@zalify/storefront-kit/commerce';

export interface SelectedOption {
  name: string;
  value: string;
}

export interface VariantLike {
  id: string;
  availableForSale?: boolean;
  image?: {id?: string | null; url?: string | null} | null;
  price?: {amount: string; currencyCode: string};
  compareAtPrice?: {amount: string; currencyCode: string} | null;
  unitPrice?: {amount: string; currencyCode: string} | null;
  selectedOptions?: SelectedOption[];
  product?: {handle?: string; title?: string};
  [key: string]: unknown;
}

function optionValueOf(
  variant: VariantLike | null | undefined,
  optionName: string,
): string | undefined {
  return variant?.selectedOptions?.find((o) => o.name === optionName)?.value;
}

/**
 * Every variant the product query carries — mirror of Hydrogen's
 * getAdjacentAndFirstAvailableVariants (deduped by id).
 */
export function getKnownVariants(product: any): VariantLike[] {
  const variants: VariantLike[] = [];
  const seen = new Set<string>();
  const push = (variant: VariantLike | null | undefined) => {
    if (variant?.id && !seen.has(variant.id)) {
      seen.add(variant.id);
      variants.push(variant);
    }
  };
  push(product?.selectedOrFirstAvailableVariant);
  for (const variant of product?.variants?.nodes ?? []) push(variant);
  for (const variant of product?.adjacentVariants ?? []) push(variant);
  for (const option of product?.options ?? []) {
    for (const value of option?.optionValues ?? []) {
      push(value?.firstSelectableVariant);
    }
  }
  return variants;
}

/**
 * The variant selected by the URL — `?variant=<numeric id>` first
 * (the canonical deep-link format shared with the Liquid store and
 * ProductCard links), then legacy option pairs, then the product's
 * first available variant.
 */
export function selectedVariantFromParams(
  product: any,
  searchParams: URLSearchParams,
): VariantLike | null {
  if (!product) return null;

  const variantParam = (searchParams.get('variant') ?? '').trim();
  if (variantParam) {
    const match = getKnownVariants(product).find(
      (variant) =>
        variant.id === variantParam || numericId(variant.id) === variantParam,
    );
    if (match) return match;
  }

  const optionNames: string[] = (product.options ?? []).map(
    (option: any) => String(option.name),
  );
  const wanted = optionNames
    .map((name) => [name, searchParams.get(name)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] != null);

  if (wanted.length) {
    const match = getKnownVariants(product).find((variant) =>
      wanted.every(([name, value]) => optionValueOf(variant, name) === value),
    );
    if (match) return match;
  }
  return (
    product.selectedOrFirstAvailableVariant ?? getKnownVariants(product)[0] ?? null
  );
}

export interface ProductOptionValue {
  name: string;
  selected: boolean;
  available: boolean;
  swatch?: unknown;
  firstSelectableVariant?: VariantLike | null;
  /** Combined-listing child products live at another URL entirely. */
  isDifferentProduct: boolean;
  handle: string;
  /** Search params selecting this value (keeps the other selections). */
  variantUriQuery: string;
}

export interface ProductOption {
  name: string;
  optionValues: ProductOptionValue[];
}

/**
 * Options mapped for the variant picker — a pure approximation of
 * @shopify/hydrogen's getProductOptions: `selected` compares against
 * the current variant, `variantUriQuery` selects the value while
 * keeping the other current selections, `available` reads the target
 * variant when the query data can resolve it (else the value's own
 * first selectable variant).
 */
export function getProductOptions(
  product: any,
  selectedVariant: VariantLike | null,
): ProductOption[] {
  const knownVariants = getKnownVariants(product);
  const current = new Map<string, string>(
    (selectedVariant?.selectedOptions ?? []).map((o) => [o.name, o.value]),
  );

  return (product?.options ?? []).map((option: any): ProductOption => {
    const optionName = String(option.name);
    return {
      name: optionName,
      optionValues: (option.optionValues ?? []).map(
        (value: any): ProductOptionValue => {
          const valueName = String(value.name);
          const firstSelectable: VariantLike | null =
            value.firstSelectableVariant ?? null;

          // The combination "current selections with this option
          // switched to the value", when the query data knows it.
          const target = new Map(current);
          target.set(optionName, valueName);
          const targetVariant =
            knownVariants.find((variant) =>
              [...target].every(
                ([name, wanted]) => optionValueOf(variant, name) === wanted,
              ),
            ) ?? firstSelectable;

          const handle: string =
            firstSelectable?.product?.handle ?? product.handle;
          const isDifferentProduct = handle !== product.handle;

          const params = new URLSearchParams();
          const uriSource =
            (isDifferentProduct ? firstSelectable : targetVariant) ??
            firstSelectable;
          if (uriSource?.id) {
            // Canonical deep link (Liquid store / ProductCard parity).
            params.set('variant', numericId(uriSource.id));
          } else if (uriSource?.selectedOptions?.length) {
            for (const {name, value: v} of uriSource.selectedOptions) {
              params.set(name, v);
            }
          } else {
            for (const [name, v] of target) params.set(name, v);
          }

          return {
            name: valueName,
            selected: current.get(optionName) === valueName,
            available: targetVariant?.availableForSale ?? true,
            swatch: value.swatch,
            firstSelectableVariant: firstSelectable,
            isDifferentProduct,
            handle,
            variantUriQuery: params.toString(),
          };
        },
      ),
    };
  });
}
