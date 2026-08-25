'use client';
/**
 * Port of sections/collection.liquid (via the Hydrogen mirror) —
 * collection product grid with facets (ui-react's <Facets>) and promo
 * blocks claiming grid slots by position on the first page.
 * CSS: app/styles/components/sections-collection.css (+ snippets-facets.css,
 * snippets-promo-card.css)
 *
 * Data: useResource('collection') — the COLLECTION query shape
 * (products connection + products.filters), products queried with
 * PRODUCT_CARD_FRAGMENT. Pagination: theme-styled cursor links
 * replacing Hydrogen's <Pagination>.
 */
import {useSearchParams} from 'next/navigation';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {
  COLLECTION_SORT_OPTIONS,
  Facets,
  PlaceholderSvg,
  ProductCard,
  imageUrl,
  settingImageUrl,
  t,
  useResource,
} from '@zalify/storefront-kit/react';
import {PaginationLinks} from '~/components/Pagination';

interface CollectionSettings {
  color_scheme?: string;
  section_spacing?: string;
}

interface PromoSettings {
  image?: string;
  video?: string;
  text?: string;
  button_label?: string;
  link?: string;
  position?: number;
}

/** Port of snippets/promo-card.liquid (inline — promo blocks only render here). */
function PromoCard({settings}: {settings: PromoSettings}) {
  const image = settingImageUrl(settings.image);
  const video = settingImageUrl(settings.video);
  return (
    <div className="promo-card">
      {video ? (
        <video
          className="promo-card__video"
          autoPlay
          loop
          muted
          playsInline
          src={video}
        />
      ) : image ? (
        <img
          className="promo-card__image"
          src={imageUrl(image, 900)}
          sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 33vw, 50vw"
          loading="lazy"
          alt=""
        />
      ) : (
        <PlaceholderSvg className="promo-card__placeholder" />
      )}

      {(settings.text || settings.button_label) && (
        <div className="promo-card__panel">
          {settings.text ? (
            <p className="promo-card__text">{settings.text}</p>
          ) : null}
          {settings.button_label ? (
            <a
              className="button button--secondary promo-card__button"
              href={settings.link || '#'}
            >
              {settings.button_label}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CollectionSection({
  section,
  settings,
}: SectionProps<CollectionSettings>) {
  const {color_scheme: colorScheme = 'scheme-1', section_spacing: spacing = 'md'} =
    settings;
  const collection = useResource<any>('collection');
  const searchParams = useSearchParams();

  if (!collection) return null;

  const filters: any[] =
    collection.products?.filters ?? collection.filters ?? [];
  const products: any[] = collection.products?.nodes ?? [];

  // Promo blocks claim grid slots by position (first page only);
  // each inserted promo shifts the following products down
  const isFirstPage =
    !searchParams.get('cursor') && !searchParams.get('direction');
  const promoBlocks = (section.block_order ?? [])
    .map((key) => ({key, block: section.blocks?.[key]}))
    .filter(({block}) => block && !block.disabled && block.type === 'promo');

  let slot = 0;
  const cells: React.ReactNode[] = [];
  for (const product of products) {
    if (isFirstPage) {
      for (const {key, block} of promoBlocks) {
        const promoSettings = (block!.settings ?? {}) as PromoSettings;
        if (promoSettings.position === slot + 1) {
          slot += 1;
          cells.push(
            <li key={`promo-${key}`}>
              <PromoCard settings={promoSettings} />
            </li>,
          );
        }
      }
    }
    slot += 1;
    cells.push(
      <li key={product.id}>
        <ProductCard product={product} loading={slot <= 4 ? 'eager' : 'lazy'} />
      </li>,
    );
  }

  return (
    <div
      className={`collection section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${spacing})`,
        } as React.CSSProperties
      }
    >
      <div className="collection__inner">
        <header
          className="collection__header stack"
          style={{'--stack-gap': 'var(--space-xs)'} as React.CSSProperties}
        >
          <h1>{collection.title}</h1>
          {collection.description ? (
            <div
              className="collection__description"
              dangerouslySetInnerHTML={{
                __html: collection.descriptionHtml ?? collection.description,
              }}
            />
          ) : null}
        </header>

        {filters.length > 0 && (
          <Facets
            filters={filters}
            resultsUrl={`/collections/${collection.handle}`}
            resultsCount={products.length}
            sortOptions={COLLECTION_SORT_OPTIONS}
            defaultSortBy="manual"
          />
        )}

        {products.length > 0 ? (
          <ul className="product-grid" role="list">
            {cells}
          </ul>
        ) : (
          <p className="collection__empty">{t('collections.empty')}</p>
        )}

        <PaginationLinks
          pageInfo={collection.products?.pageInfo}
          className="collection__pagination"
        />
      </div>
    </div>
  );
}
