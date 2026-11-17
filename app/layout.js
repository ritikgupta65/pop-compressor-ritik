import { Onest, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import '@/styles/globals.scss';

const ui = Onest({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-ui', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-serif', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'POP · Compress',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
