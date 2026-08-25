'use client';
/**
 * Client wrapper for ui-react's <SectionGroup> (header-group /
 * footer-group / overlay-group) — see ThemeTemplateClient.
 */
import '~/lib/theme-setup';
import {SectionGroup} from '@zalify/storefront-kit/react';

export default function SectionGroupClient({
  name,
  sectionData,
}: {
  name: string;
  sectionData?: Record<string, unknown>;
}) {
  return <SectionGroup name={name} sectionData={sectionData} />;
}
