'use client';
/**
 * Port of snippets/quick-add-dialog.liquid (via the Hydrogen mirror) —
 * the shared quick-add dialog shell: close button, a loading skeleton
 * mirroring the loaded layout, and the content slot. Rendered once per
 * page from the root layout. The Liquid theme fills the slot with
 * section HTML fetched by cards.js; here commerce-core's
 * 'quick-add:open' (emitted by ui-react's <ProductCard/>, which checks
 * for this exact #QuickAddDialog id) delivers the product and
 * <QuickAdd/> renders in place — the data is already on the client,
 * so the skeleton's [data-loading] state never needs to switch on.
 *
 * Dialog semantics mirror src/entries/cards.ts + src/lib/dialog.ts:
 * light dismiss on backdrop click, [data-dialog-close] closes, and a
 * successful add (cart:updated) closes the dialog to get out of the
 * cart drawer's way (the drawer opens on the same event).
 *
 * CSS: app/styles/components/snippets-quick-add-dialog.css
 */
import {useEffect, useRef, useState} from 'react';
import {Icon, t} from '@zalify/storefront-kit/react';
import type {CardProduct} from '@zalify/storefront-kit/commerce';
import {on} from '@zalify/storefront-kit/commerce';
import {QuickAdd} from '~/components/sections/quick-add';

export function QuickAddDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [product, setProduct] = useState<CardProduct | null>(null);

  useEffect(() => {
    const offOpen = on('quick-add:open', ({product: next}) => {
      setProduct(next);
      const dialog = dialogRef.current;
      // showModal() throws if the dialog is already open
      if (dialog && !dialog.open) dialog.showModal();
    });
    // A successful add opens the cart drawer; get out of its way
    const offUpdated = on('cart:updated', () => dialogRef.current?.close());
    return () => {
      offOpen();
      offUpdated();
    };
  }, []);

  return (
    <dialog
      id="QuickAddDialog"
      className="quick-add-dialog"
      ref={dialogRef}
      {...{'scroll-lock': ''}}
      onClick={(event) => {
        // Light dismiss: clicks land on the <dialog> itself only when
        // they hit the backdrop (children cover the whole panel).
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <button
        type="button"
        className="quick-add-dialog__close"
        data-dialog-close=""
        aria-label={t('general.close')}
        onClick={() => dialogRef.current?.close()}
      >
        <Icon name="icon-close" />
      </button>

      <div className="quick-add-dialog__skeleton" aria-hidden="true">
        <div className="quick-add-skeleton__intro">
          <span className="quick-add-skeleton__thumb"></span>
          <span className="quick-add-skeleton__lines">
            <span className="quick-add-skeleton__bar" style={{width: '75%'}}></span>
            <span className="quick-add-skeleton__bar" style={{width: '40%'}}></span>
          </span>
        </div>
        <div className="quick-add-skeleton__group">
          <span className="quick-add-skeleton__bar" style={{width: '4rem'}}></span>
          <span className="quick-add-skeleton__pills">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </div>
        <div className="quick-add-skeleton__group">
          <span className="quick-add-skeleton__bar" style={{width: '4rem'}}></span>
          <span className="quick-add-skeleton__pills">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </div>
        <span className="quick-add-skeleton__button"></span>
      </div>

      <div className="quick-add-dialog__content">
        {product ? (
          <QuickAdd key={product.id} product={product} />
        ) : null}
      </div>
    </dialog>
  );
}
