'use client';
/**
 * Port of snippets/mega-promo.liquid (via the Hydrogen mirror) — the
 * promo cards of one mega-menu promo block. The block holds up to six
 * image/caption/link slots (slot 1 uses the legacy image/caption/link
 * ids); empty slots are skipped. The caller wraps the output in a
 * .mega-promos-row scroller. CSS: app/styles/components/snippets-mega-promo.css
 */
import type {BlockData} from '@zalify/storefront-kit/react';
import {imageUrl, PlaceholderSvg, settingImageUrl} from '@zalify/storefront-kit/react';

interface PromoSlot {
  rawImage: unknown;
  image: string | null;
  caption: string;
  link: string;
}

export function MegaPromo({block}: {block: BlockData}) {
  const settings = (block.settings ?? {}) as Record<string, unknown>;

  const slots: PromoSlot[] = [];
  for (let i = 1; i <= 6; i++) {
    const suffix = i === 1 ? '' : `_${i}`;
    const rawImage = settings[`image${suffix}`];
    const caption =
      typeof settings[`caption${suffix}`] === 'string'
        ? (settings[`caption${suffix}`] as string)
        : '';
    const link =
      typeof settings[`link${suffix}`] === 'string'
        ? (settings[`link${suffix}`] as string)
        : '';
    // Mirror of `{% if slot_image or slot_caption != blank %}`
    if (!rawImage && caption === '') continue;
    slots.push({rawImage, image: settingImageUrl(rawImage), caption, link});
  }

  return (
    <>
      {slots.map((slot, i) => (
        <a
          key={i}
          className="mega-promo stack"
          href={slot.link !== '' ? slot.link : undefined}
        >
          {slot.image ? (
            <img
              className="mega-promo__image"
              src={imageUrl(slot.image, 600)}
              srcSet={[300, 450, 600]
                .map((w) => `${imageUrl(slot.image!, w)} ${w}w`)
                .join(', ')}
              sizes="12rem"
              loading="lazy"
              alt=""
            />
          ) : (
            <PlaceholderSvg className="mega-promo__image mega-promo__placeholder" />
          )}
          {slot.caption !== '' && (
            <span className="mega-promo__caption">
              <span className="mega-promo__caption-text">{slot.caption}</span>
              <span className="mega-promo__arrow" aria-hidden="true">
                &rarr;
              </span>
            </span>
          )}
        </a>
      ))}
    </>
  );
}
