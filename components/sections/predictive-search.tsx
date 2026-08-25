'use client';
/**
 * Port of sections/predictive-search.liquid + the SearchDrawer dialog
 * from sections/header.liquid + src/entries/search.ts (the
 * <predictive-search> island, debounced live results), via the
 * Hydrogen mirror. Mounted once from the root layout, like Hydrogen's
 * PageLayout.
 *
 * Opening mirrors the theme's dialog system (src/lib/dialog.ts): the
 * header renders a trigger with data-dialog-open="SearchDrawer" (a
 * plain /search anchor as the no-JS fallback); a document-level click
 * listener here opens the drawer for exactly that attribute contract,
 * and data-dialog-close inside closes it.
 *
 * Data: input changes are debounced 250ms (src/entries/search.ts) and
 * fetch /api/predictive-search?q=… — a route handler running the
 * Storefront `predictiveSearch` query (the Next stand-in for
 * Hydrogen's /search?predictive fetcher / the Liquid theme's
 * Predictive Search API + Section Rendering). Enter or the submit
 * button navigates to /search?q=….
 *
 * CSS: app/styles/components/sections-predictive-search.css (results)
 * and sections-header.css (.search-drawer*), .drawer in critical.css.
 */
import {useEffect, useRef, useState} from 'react';
import type React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Icon, Price, imageUrl, t} from '@zalify/storefront-kit/react';
import type {Money} from '@zalify/storefront-kit/commerce';

const DIALOG_ID = 'SearchDrawer';

interface PredictiveProduct {
  id: string;
  title: string;
  handle: string;
  trackingParameters?: string | null;
  featuredImage?: {url: string; altText?: string | null} | null;
  selectedOrFirstAvailableVariant?: {
    image?: {url: string; altText?: string | null} | null;
    price?: Money;
    compareAtPrice?: Money | null;
  } | null;
}

interface PredictiveResults {
  term: string;
  products: PredictiveProduct[];
}

/** Mirror of Hydrogen's urlWithTrackingParams (app/lib/search.ts). */
function urlWithTrackingParams({
  baseUrl,
  trackingParams,
  term,
}: {
  baseUrl: string;
  trackingParams?: string | null;
  term: string;
}): string {
  let search = new URLSearchParams({q: encodeURIComponent(term)}).toString();
  if (trackingParams) search = `${search}&${trackingParams}`;
  return `${baseUrl}?${search}`;
}

export default function PredictiveSearchSection() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of predictive_search.performed: null until a query ran.
  const [results, setResults] = useState<PredictiveResults | null>(null);

  useEffect(() => {
    // Mirror of registerDialogs() in src/lib/dialog.ts, scoped to this
    // drawer: [data-dialog-open="SearchDrawer"] opens, [data-dialog-close]
    // inside closes. The theme header's search trigger uses exactly this
    // (its /search href stays as the no-JS fallback).
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const opener = target.closest<HTMLElement>('[data-dialog-open]');
      if (opener) {
        if (opener.dataset['dialogOpen'] !== DIALOG_ID) return;
        event.preventDefault();
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) {
          dialog.showModal();
          inputRef.current?.focus();
        }
        return;
      }

      if (
        target.closest('[data-dialog-close]') &&
        dialogRef.current?.contains(target)
      ) {
        dialogRef.current?.close();
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /** Run the predictive query (already debounced by the caller). */
  const fetchResults = (value: string) => {
    const term = value.trim();
    abortRef.current?.abort();
    if (!term) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    fetch(`/api/predictive-search?q=${encodeURIComponent(term)}&limit=10`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setResults({
          term,
          products: (data?.result?.items?.products ??
            []) as PredictiveProduct[],
        });
      })
      .catch((error: unknown) => {
        if ((error as {name?: string})?.name === 'AbortError') return;
        setResults({term, products: []});
      });
  };

  const closeDrawer = () => dialogRef.current?.close();

  /** Enter / submit → the full results page (mirror of goToSearch). */
  const submitSearch = () => {
    const term = inputRef.current?.value.trim() ?? '';
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
    closeDrawer();
  };

  /** Light dismiss: clicks on the <dialog> itself hit the backdrop. */
  const onDialogClick = (event: React.MouseEvent) => {
    if (event.target === dialogRef.current) dialogRef.current?.close();
  };

  return (
    <div id={DIALOG_ID}>
      <dialog
        scroll-lock=""
        ref={dialogRef}
        className="drawer drawer--top"
        aria-label={t('search.title')}
        onClick={onDialogClick}
      >
        <div className="search-drawer stack">
          <form
            className="search-drawer__form"
            action="/search"
            method="get"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <input
              ref={inputRef}
              className="search-drawer__input"
              type="search"
              name="q"
              placeholder={t('search.placeholder')}
              autoComplete="off"
              onChange={(event) => {
                // 250ms debounce, mirroring src/entries/search.ts
                const value = event.currentTarget.value;
                clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => fetchResults(value), 250);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch();
                }
              }}
            />
            <input type="hidden" name="options[prefix]" value="last" />
            <button
              type="submit"
              className="header__icon-button"
              aria-label={t('search.submit')}
            >
              <Icon name="icon-search" />
            </button>
            <button
              type="button"
              className="header__icon-button"
              data-dialog-close=""
              aria-label={t('general.close')}
            >
              <Icon name="icon-close" />
            </button>
          </form>

          <div className="search-drawer__results">
            {/* Mirror of predictive_search.performed: nothing until a term */}
            {results ? (
              results.products.length === 0 ? (
                <p className="predictive-search__none">
                  {t('search.no_results_html', {terms: results.term})}
                </p>
              ) : (
                <>
                  <ul className="predictive-search__list" role="list">
                    {results.products.map((product) => {
                      const variant = product.selectedOrFirstAvailableVariant;
                      const image =
                        variant?.image ?? product.featuredImage ?? null;
                      const productUrl = urlWithTrackingParams({
                        baseUrl: `/products/${product.handle}`,
                        trackingParams: product.trackingParameters,
                        term: results.term,
                      });
                      return (
                        <li key={product.id}>
                          <Link
                            className="predictive-search__item"
                            href={productUrl}
                            onClick={closeDrawer}
                          >
                            {image ? (
                              <img
                                className="predictive-search__image"
                                src={imageUrl(image.url, 128)}
                                alt={image.altText ?? product.title}
                                loading="lazy"
                              />
                            ) : null}
                            <span className="predictive-search__meta">
                              <span className="predictive-search__title">
                                {product.title}
                              </span>
                              <Price
                                price={variant?.price}
                                compareAt={variant?.compareAtPrice}
                              />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    className="predictive-search__view-all"
                    href={`/search?q=${encodeURIComponent(results.term)}`}
                    onClick={closeDrawer}
                  >
                    {t('search.view_all')}
                  </Link>
                </>
              )
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
