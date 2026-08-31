'use client';

import {useEffect, useState} from 'react';
import {alternateListId, sharedListId, workspaceId} from '~/lib/config';
import {trackPixel, type PixelEvent} from '~/lib/pixel';

const product = {id: 'gid://shopify/Product/1001', title: 'Demo Hoodie', vendor: 'Pawfolk'};

export function PixelPlayground() {
  const [events, setEvents] = useState<PixelEvent[]>([]);
  const [email, setEmail] = useState('');

  function fire(event: string, properties: Record<string, unknown> = {}) {
    trackPixel(event, properties);
    setEvents((current) => [{event, properties, at: new Date().toLocaleTimeString()}, ...current].slice(0, 20));
  }

  useEffect(() => {
    fire('page_viewed', {page: {url: window.location.href, title: document.title}});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="shell">
      <p className="eyebrow">Zalify headless Pixel</p>
      <h1>A tiny Next.js 16 event lab.</h1>
      <p className="intro">
        This project intentionally has no Shopify theme or Storefront API. Use the controls below to
        see the exact browser events a headless storefront can send to Zalify CDN Pixel.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Navigation events</h2>
          <p>Simulate route changes and commerce resources.</p>
          <div className="buttons">
            <button onClick={() => fire('page_viewed', {page: {path: '/collections/new'}})}>Page changed</button>
            <button onClick={() => fire('product_viewed', {productVariant: {id: 'gid://shopify/ProductVariant/1', product}})}>Product page</button>
            <button onClick={() => fire('collection_viewed', {collection: {id: 'gid://shopify/Collection/1', title: 'New arrivals', handle: 'new-arrivals'}})}>Collection page</button>
            <button onClick={() => fire('search_submitted', {searchResult: {query: 'hoodie'}})}>Search submitted</button>
          </div>
        </section>

        <section className="card">
          <h2>Commerce events</h2>
          <p>These payloads mirror the events emitted by a headless cart.</p>
          <div className="buttons">
            <button onClick={() => fire('product_added_to_cart', {cartLine: {quantity: 1, merchandise: {id: 'gid://shopify/ProductVariant/1', product}}})}>Add to cart</button>
            <button onClick={() => fire('checkout_started', {checkout: {token: 'demo-cart-token', currencyCode: 'USD', totalPrice: {amount: 49, currencyCode: 'USD'}}})}>Start checkout</button>
          </div>
        </section>

        <section className="card">
          <h2>Forms and Lists</h2>
          <p>Two forms can share a List, or target separate Lists.</p>
          <div className="form">
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="test@example.com" /></label>
            <button onClick={() => fire('form_submitted', {form_id: 'newsletter', list_id: sharedListId, email})}>Submit → shared List</button>
            <button className="secondary" onClick={() => fire('form_submitted', {form_id: 'vip_waitlist', list_id: alternateListId, email})}>Submit → alternate List</button>
          </div>
          <p className="muted">Workspace: {workspaceId}<br />Shared List: {sharedListId}</p>
        </section>
      </div>

      <section className="card" style={{marginTop: 16}}>
        <h2>Event activity</h2>
        <p className="muted">The log is local UI state; CDN Pixel receives the same calls.</p>
        <div className="log" aria-live="polite">
          {events.length === 0 ? <div>No events yet.</div> : events.map((item, index) => <div key={`${item.at}-${index}`}><strong>{item.event}</strong> · {item.at}<br />{JSON.stringify(item.properties)}</div>)}
        </div>
      </section>
    </main>
  );
}
