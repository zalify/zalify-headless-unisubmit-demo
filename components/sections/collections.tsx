'use client';
/**
 * Port of sections/collections.liquid (via the Hydrogen mirror) — the
 * list-collections template's collection card grid.
 * CSS: app/styles/components/sections-collections.css
 *
 * Data: useResource('collections') — collections connection
 * (nodes {id, title, handle, image}, pageInfo).
 */
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {PlaceholderSvg, imageUrl, t, useResource} from '@zalify/storefront-kit/react';
import {PaginationLinks} from '~/components/Pagination';

interface CollectionsSettings {
  color_scheme?: string;
  section_spacing?: string;
}

export default function CollectionsSection({
  settings,
}: SectionProps<CollectionsSettings>) {
  const {color_scheme: colorScheme = 'scheme-1', section_spacing: spacing = 'md'} =
    settings;
  const collections = useResource<any>('collections');

  if (!collections) return null;

  const nodes: any[] = collections.nodes ?? [];

  return (
    <div
      className={`collections-page section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${spacing})`,
        } as React.CSSProperties
      }
    >
      <div
        className="collections-page__inner stack"
        style={{'--stack-gap': 'var(--space-xl)'} as React.CSSProperties}
      >
        <h1>{t('collections.title')}</h1>

        <ul className="collections-page__grid" role="list">
          {nodes.map((collection) => (
            <li key={collection.id}>
              <Link
                className="collection-card stack"
                href={`/collections/${collection.handle}`}
                style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
              >
                <span className="collection-card__media">
                  {collection.image ? (
                    <img
                      className="collection-card__image"
                      src={imageUrl(collection.image.url, 900)}
                      alt={collection.image.altText ?? collection.title}
                      width={collection.image.width ?? undefined}
                      height={collection.image.height ?? undefined}
                      sizes="(min-width: 48rem) 33vw, 50vw"
                      loading="lazy"
                    />
                  ) : (
                    <PlaceholderSvg className="collection-card__image collection-card__placeholder" />
                  )}
                </span>
                <span className="collection-card__title">
                  {collection.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <PaginationLinks
          pageInfo={collections.pageInfo}
          className="collections-page__pagination"
        />
      </div>
    </div>
  );
}
