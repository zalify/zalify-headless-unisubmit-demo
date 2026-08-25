'use client';
/**
 * Port of sections/search.liquid (via the Hydrogen mirror) — search
 * page with results grid and facets.
 * CSS: app/styles/components/sections-search.css (+ snippets-facets.css)
 *
 * Data: useResource('searchResult') — the shape the /search route
 * builds: {type: 'regular', term, error?, result: {total, items:
 * {articles, pages, products}}}. Products queried with
 * PRODUCT_CARD_FRAGMENT so <ProductCard/> can render them.
 */
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {
  Facets,
  PlaceholderSvg,
  ProductCard,
  SEARCH_SORT_OPTIONS,
  imageUrl,
  t,
  useResource,
} from '@zalify/storefront-kit/react';
import {PaginationLinks} from '~/components/Pagination';

interface SearchSettings {
  color_scheme?: string;
  section_spacing?: string;
}

/** Non-product results (pages, articles) — the theme's result-card markup. */
function ResultCard({result, type}: {result: any; type: 'article' | 'page'}) {
  const url =
    type === 'article'
      ? `/blogs/${result.blog?.handle ?? 'news'}/${result.handle}`
      : `/pages/${result.handle}`;
  const image = result.image ?? result.featuredImage ?? null;
  return (
    <article
      className="result-card stack"
      style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
    >
      <Link href={url} className="result-card__media">
        {image ? (
          <img
            className="result-card__image"
            src={imageUrl(image.url, 900)}
            alt={image.altText ?? ''}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            sizes="(min-width: 48rem) 33vw, 50vw"
            loading="lazy"
          />
        ) : (
          <PlaceholderSvg className="result-card__image result-card__placeholder" />
        )}
      </Link>
      <p className="result-card__type">
        {type === 'article' ? t('general.article') : t('general.page')}
      </p>
      <h3 className="result-card__title">
        <Link href={url}>{result.title}</Link>
      </h3>
    </article>
  );
}

export default function SearchSection({settings}: SectionProps<SearchSettings>) {
  const {color_scheme: colorScheme = 'scheme-1', section_spacing: spacing = 'md'} =
    settings;
  const searchResult = useResource<any>('searchResult');

  const term: string = searchResult?.term ?? '';
  const performed = Boolean(term);
  const result = searchResult?.result;
  const total: number = result?.total ?? 0;
  const products: any[] = result?.items?.products?.nodes ?? [];
  const pages: any[] = result?.items?.pages?.nodes ?? [];
  const articles: any[] = result?.items?.articles?.nodes ?? [];
  const filters: any[] =
    result?.items?.products?.filters ?? result?.filters ?? [];

  return (
    <div
      className={`search-page section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${spacing})`,
        } as React.CSSProperties
      }
    >
      <div
        className="search-page__inner stack"
        style={{'--stack-gap': 'var(--space-xl)'} as React.CSSProperties}
      >
        <header
          className="search-page__header stack"
          style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
        >
          <h1>{t('search.title')}</h1>

          <form
            action="/search"
            method="get"
            role="search"
            className="search-page__form"
          >
            <label className="visually-hidden" htmlFor="SearchPageInput">
              {t('search.placeholder')}
            </label>
            <input
              id="SearchPageInput"
              type="search"
              name="q"
              defaultValue={term}
              placeholder={t('search.placeholder')}
            />
            <button type="submit" className="button">
              {t('search.submit')}
            </button>
          </form>

          {performed &&
            (total === 0 ? (
              <p>{t('search.no_results_html', {terms: term})}</p>
            ) : (
              <p className="search-page__count">
                {t('search.results_for_html', {terms: term, count: total})}
              </p>
            ))}
        </header>

        {performed && total > 0 && (
          <>
            {filters.length > 0 && (
              <Facets
                filters={filters}
                resultsUrl="/search"
                resultsCount={total}
                sortOptions={SEARCH_SORT_OPTIONS}
                defaultSortBy="relevance"
                terms={term}
              />
            )}

            <ul className="product-grid" role="list">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
              {articles.map((article) => (
                <li key={article.id}>
                  <ResultCard result={article} type="article" />
                </li>
              ))}
              {pages.map((page) => (
                <li key={page.id}>
                  <ResultCard result={page} type="page" />
                </li>
              ))}
            </ul>

            <PaginationLinks
              pageInfo={result?.items?.products?.pageInfo}
              className="search-page__pagination"
            />
          </>
        )}
      </div>
    </div>
  );
}
