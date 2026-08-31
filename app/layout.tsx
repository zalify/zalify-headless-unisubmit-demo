import type {Metadata} from 'next';
import './globals.css';
import {workspaceId} from '~/lib/config';

export const metadata: Metadata = {
  title: 'Zalify Pixel headless demo',
  description: 'A minimal Next.js 16 project for Zalify Pixel events.',
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.zalify=window.zalify||function(){(zalify.q=zalify.q||[]).push(arguments)};',
          }}
        />
        <script
          src={`https://cdn.zalify.com/pixel.js?wid=${encodeURIComponent(workspaceId)}`}
          defer
        />
        {children}
      </body>
    </html>
  );
}
