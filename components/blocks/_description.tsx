'use client';
/**
 * Port of blocks/_description.liquid (via the Hydrogen mirror) — the
 * product description inside a <details> accordion.
 * CSS: app/styles/components/blocks-accordion.css
 */
import type {BlockProps} from '@zalify/storefront-kit/react';
import {useResource} from '@zalify/storefront-kit/react';

interface DescriptionSettings {
  heading?: string;
}

export default function DescriptionBlock({
  settings,
}: BlockProps<DescriptionSettings>) {
  const {heading = 'Description'} = settings;
  const product = useResource<any>('product');
  const html: string = product?.descriptionHtml ?? '';
  if (!html) return null;

  return (
    <details className="accordion">
      <summary className="accordion__summary">
        <span>{heading}</span>
        <span className="accordion__icon" aria-hidden="true" />
      </summary>
      <div
        className="accordion__content"
        dangerouslySetInnerHTML={{__html: html}}
      />
    </details>
  );
}
