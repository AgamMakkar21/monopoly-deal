import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bungee } from 'next/font/google';

const monopolyHeadingFont = Bungee({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-monopoly',
});

export const metadata: Metadata = {
  title: 'Monopoly Deal Multiplayer',
  description: 'Real-time multiplayer Monopoly Deal web app',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={monopolyHeadingFont.variable}>{children}</body>
    </html>
  );
}
