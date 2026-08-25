'use client';
/**
 * Port of sections/product-recommendations.liquid (via the Hydrogen
 * mirror) — "You may also like" / "Pairs well with" on the PDP. The
 * sibling server loader (lib/section-loaders.ts) provides the products
 * and an empty result renders nothing, so the page shows no gap.
 * CSS: app/styles/components/sections-product-recommendations.css
 */
import type {SectionProps} from '@zalify/storefront-kit/react';
import {ProductCard, t, useSectionData} from '@zalify/storefront-kit/react';
import type {CardProduct} from '@zalify/storefront-kit/commerce';

interface RecommendationsSettings {
  intent?: 'related' | 'complementary';
  layout?: 'product-grid' | 'recommendations__row';
  products_to_show?: number;
  color_scheme?: string;
  section_spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export default function ProductRecommendationsSection({
  settings,
}: SectionProps<RecommendationsSettings>) {
  const {
    intent = 'related',
    layout = 'product-grid',
    color_scheme: colorScheme = 'scheme-1',
    section_spacing: sectionSpacing = 'md',
  } = settings;

  const data = useSectionData<{products?: CardProduct[]}>();
  const products = data?.products ?? [];
  if (!products.length) return null;

  return (
    <div className={`recommendations color-${colorScheme} full-width`}>
      <div
        className="recommendations__inner section"
        style={
          {
            '--section-spacing': `var(--space-section-${sectionSpacing})`,
          } as React.CSSProperties
        }
      >
        <h2 className="recommendations__heading">
          {intent === 'complementary'
            ? t('products.complementary')
            : t('products.recommendations')}
        </h2>
        <ul className={layout} role="list">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
