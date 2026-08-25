'use client';

import {useState} from 'react';
import {
  createIdempotencyKey,
  submitUniSubmit,
  type UniSubmitEvent,
} from '~/lib/zalify-unisubmit';

type SignupFormProps = {
  workspaceId: string;
  listId?: string;
  formId: string;
  onEvent?: (event: UniSubmitEvent) => void;
  onSuccess?: () => void;
};

export function ZalifySignupForm({
  workspaceId,
  listId,
  formId,
  onEvent,
  onSuccess,
}: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [retryKey, setRetryKey] = useState<string>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    if (!listId) {
      setStatus('error');
      setMessage('Add NEXT_PUBLIC_ZALIFY_LIST_ID to .env before submitting.');
      return;
    }

    const nextKey = retryKey ?? createIdempotencyKey(formId);
    setRetryKey(nextKey);
    setStatus('submitting');
    setMessage('');

    try {
      await submitUniSubmit(
        {
          workspaceId,
          formId,
          listId,
          email,
          firstName,
          emailMarketingConsent: consent,
          payload: {source: formId.includes('popup') ? 'popup' : 'inline'},
        },
        nextKey,
        onEvent,
      );
      setStatus('success');
      setMessage('Submitted — check the Zalify List and event stream.');
      setRetryKey(undefined);
      onSuccess?.();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Submission failed.');
    }
  }

  return (
    <form className="zalify-signup-form" data-zalify-form onSubmit={handleSubmit}>
      <div className="zalify-signup-form__fields">
        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span>First name <small>(optional)</small></span>
          <input
            name="firstName"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Ada"
            autoComplete="given-name"
          />
        </label>
      </div>
      <label className="zalify-signup-form__consent">
        <input
          name="emailMarketingConsent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>Include this contact in marketing messages</span>
      </label>
      <button className="button zalify-signup-form__submit" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Submit to Zalify'}
      </button>
      {message && (
        <p className={`zalify-signup-form__message is-${status}`} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
    </form>
  );
}
