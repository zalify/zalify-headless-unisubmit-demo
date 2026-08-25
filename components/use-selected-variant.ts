'use client';
/**
 * The client-side mirror of Hydrogen's useOptimisticVariant: the
 * selected variant derived from the URL's option search params on
 * every render. Navigation (router.replace from the variant picker)
 * updates the params instantly, so the UI answers before the RSC
 * round trip lands with the server-resolved product.
 */
import {useMemo} from 'react';
import {useSearchParams} from 'next/navigation';
import {selectedVariantFromParams, type VariantLike} from '~/lib/product-options';

export function useSelectedVariant(product: any): VariantLike | null {
  const searchParams = useSearchParams();
  return useMemo(
    () =>
      selectedVariantFromParams(
        product,
        new URLSearchParams(searchParams.toString()),
      ),
    [product, searchParams],
  );
}
