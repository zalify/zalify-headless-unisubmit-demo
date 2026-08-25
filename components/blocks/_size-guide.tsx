'use client';
/**
 * Port of blocks/_size-guide.liquid (via the Hydrogen mirror) — this
 * block only contributes the size-guide dialog (a mirror of
 * snippets/modal.liquid); the visible trigger lives next to the size
 * option's label in the variant picker and is revealed by CSS via
 * `.product:has([data-size-guide])`.
 *
 * The Shopify page's content isn't available client-side —
 * TODO: fetch the page (handle in settings.page) title + body through
 * a server loader and render it into .modal__content.
 *
 * CSS: app/styles/components/snippets-modal.css
 */
import {useRef} from 'react';
import type {BlockProps} from '@zalify/storefront-kit/react';
import {Icon, t} from '@zalify/storefront-kit/react';

interface SizeGuideSettings {
  /** Shopify page handle, e.g. "size-guide-01". */
  page?: string;
}

export default function SizeGuideBlock({
  settings,
  sectionId,
}: BlockProps<SizeGuideSettings>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const page = settings.page;

  if (!page) return <div hidden />;

  const title = t('products.size_guide');

  return (
    // No `hidden` on the wrapper: a display:none ancestor would keep the
    // modal dialog from rendering when opened into the top layer.
    <div id={`SizeGuide-${sectionId}`} data-size-guide>
      <dialog
        ref={dialogRef}
        className="modal"
        aria-label={title}
        onClick={(event) => {
          // Native backdrop clicks land on the dialog element itself
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <header className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={() => dialogRef.current?.close()}
            aria-label={t('general.close')}
          >
            <Icon name="icon-close" />
          </button>
        </header>

        <div className="modal__content">
          {/* TODO: render the Shopify page's content (page handle:
              settings.page) once a server-side page fetch exists. */}
        </div>
      </dialog>
    </div>
  );
}
