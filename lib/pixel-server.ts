/**
 * Server half of the Zalify Pixel integration — reads the hardcoded
 * workspace id from theme/pixel.json ({ "workspaceId": "…" }), the
 * merchant-owned config written by `zalify shop create` (or by hand for
 * self-hosted deploys; delete the file to disable). theme/ is never
 * touched by upgrades. No id -> no pixel (fresh scaffolds and mock.shop
 * demos stay clean). The id is public by design (it already appears in
 * every asset-library URL). Docs: https://cdn.zalify.com/llms.txt
 *
 * Server-only (node:fs) — client code imports lib/pixel.ts instead.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

let cached: string | null | undefined;

/** The project's pixel workspace id, or null when the pixel is not configured. */
export function getPixelWorkspaceId(): string | null {
  if (cached !== undefined) return cached;
  try {
    const raw = readFileSync(
      join(process.cwd(), 'theme', 'pixel.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as {workspaceId?: string};
    cached = parsed.workspaceId?.trim() || null;
  } catch {
    cached = null;
  }
  return cached;
}
