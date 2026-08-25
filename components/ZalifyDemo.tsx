'use client';

import {useState} from 'react';
import {ZalifySignupForm} from '~/components/ZalifySignupForm';
import type {UniSubmitEvent} from '~/lib/zalify-unisubmit';

type ZalifyDemoProps = {
  workspaceId: string;
  listId?: string;
};

export function ZalifyDemo({workspaceId, listId}: ZalifyDemoProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [events, setEvents] = useState<UniSubmitEvent[]>([]);

  function recordEvent(event: UniSubmitEvent) {
    setEvents((current) => [event, ...current].slice(0, 6));
  }

  return (
    <section className="zalify-demo" aria-labelledby="zalify-demo-title">
      <div className="zalify-demo__intro">
        <p className="zalify-demo__eyebrow">Zalify headless playground</p>
        <h1 id="zalify-demo-title">Pixel, popup, and UniSubmit — in a Shopify storefront.</h1>
        <p>
          This open-source demo keeps the commerce theme intact while showing two merchant-owned
          signup surfaces. Both forms call the same public UniSubmit endpoint and feed the Zalify pixel.
        </p>
      </div>
      <div className="zalify-demo__grid">
        <div className="zalify-demo__card">
          <p className="zalify-demo__card-label">Inline form</p>
          <h2>Newsletter signup</h2>
          <p>React owns the markup and state; Zalify receives the submission.</p>
          <ZalifySignupForm
            workspaceId={workspaceId}
            listId={listId}
            formId="shopify_demo_inline"
            onEvent={recordEvent}
          />
        </div>
        <div className="zalify-demo__card zalify-demo__card--accent">
          <p className="zalify-demo__card-label">Popup form</p>
          <h2>Open a modal signup</h2>
          <p>The popup is custom storefront UI, not a remotely hosted document.</p>
          <button className="button" type="button" onClick={() => setPopupOpen(true)}>
            Open popup form
          </button>
        </div>
        <aside className="zalify-demo__card zalify-demo__card--events">
          <p className="zalify-demo__card-label">Runtime check</p>
          <h2>Event activity</h2>
          <p className="zalify-demo__config">
            {listId ? 'List ID configured' : 'Set NEXT_PUBLIC_ZALIFY_LIST_ID to enable submit'}
          </p>
          {events.length ? (
            <ol>
              {events.map((event, index) => (
                <li key={`${event.type}-${event.formId}-${index}`}>
                  <code>{event.type}</code> · {event.formId}
                </li>
              ))}
            </ol>
          ) : (
            <p className="zalify-demo__muted">Submit either form to see pixel ordering here.</p>
          )}
        </aside>
      </div>
      {popupOpen && (
        <div className="zalify-demo__backdrop" role="presentation" onMouseDown={() => setPopupOpen(false)}>
          <div
            className="zalify-demo__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zalify-popup-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="zalify-demo__close" type="button" onClick={() => setPopupOpen(false)} aria-label="Close popup">
              ×
            </button>
            <p className="zalify-demo__eyebrow">Zalify popup form</p>
            <h2 id="zalify-popup-title">Get the next drop first.</h2>
            <p>Same UniSubmit contract, rendered in a merchant-owned modal.</p>
            <ZalifySignupForm
              workspaceId={workspaceId}
              listId={listId}
              formId="shopify_demo_popup"
              onEvent={recordEvent}
              onSuccess={() => setPopupOpen(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
