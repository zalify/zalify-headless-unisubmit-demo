import {trackPixel} from '~/lib/pixel';

export type UniSubmitInput = {
  workspaceId: string;
  formId: string;
  listId?: string;
  email: string;
  firstName?: string;
  emailMarketingConsent: boolean;
  payload?: Record<string, unknown>;
};

export type UniSubmitEvent =
  | {type: 'form_submitted'; formId: string}
  | {type: 'lead'; formId: string};

export function createIdempotencyKey(formId: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${formId}:${uuid}`;
}

export async function submitUniSubmit(
  input: UniSubmitInput,
  idempotencyKey: string,
  onEvent?: (event: UniSubmitEvent) => void,
): Promise<void> {
  const email = input.email.trim();
  if (!email) throw new Error('Enter an email address.');
  if (!input.workspaceId) throw new Error('Zalify workspace is not configured.');

  const eventPayload = {
    form_id: input.formId,
    ...(input.listId ? {list_id: input.listId} : {}),
    email,
    ...(input.firstName ? {firstName: input.firstName} : {}),
    emailMarketingConsent: input.emailMarketingConsent,
  };

  trackPixel('form_submitted', eventPayload);
  onEvent?.({type: 'form_submitted', formId: input.formId});

  const response = await fetch('https://reach.zalify.com/v1/public/unisubmit', {
    method: 'POST',
    credentials: 'omit',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      wid: input.workspaceId,
      identity: {
        email,
        ...(input.firstName ? {first_name: input.firstName} : {}),
      },
      submission: {
        form_id: input.formId,
        provider: 'api',
        payload: {
          ...input.payload,
          email,
          ...(input.firstName ? {firstName: input.firstName} : {}),
          emailMarketingConsent: input.emailMarketingConsent,
        },
      },
      subscribe: {
        ...(input.listId ? {list_id: input.listId} : {}),
        email_marketing_consent: input.emailMarketingConsent,
      },
      context: {page_url: window.location.href},
      idempotency_key: idempotencyKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`UniSubmit failed with HTTP ${response.status}`);
  }

  trackPixel('lead', {email});
  onEvent?.({type: 'lead', formId: input.formId});
}
