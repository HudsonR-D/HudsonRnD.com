import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Proofly — Official Birth Certificate Requests',
  description:
    'Privacy-first, on-chain consent for Colorado birth certificate requests. No account required. Your data is deleted after filing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-white font-sans antialiased">
        {/* Shared Nav */}
        <nav className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Hudson R&D" className="h-8 w-auto" />
              <div className="flex flex-col leading-none">
                <span className="text-base font-semibold tracking-tight">Proofly</span>
                <span className="text-xs text-zinc-500">by Hudson R&D</span>
              </div>
            </a>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a href="https://hudsonrnd.com/#tech" className="text-zinc-400 hover:text-white transition">
                Technology
              </a>
              <a href="https://hudsonrnd.com/#applications" className="text-zinc-400 hover:text-white transition">
                Applications
              </a>
              <a href="https://hudsonrnd.com/#about" className="text-zinc-400 hover:text-white transition">
                About
              </a>
            </div>

            <a
              href="https://hudsonrnd.com/#contact"
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl text-sm transition"
            >
              Partner / Inquire
            </a>
          </div>
        </nav>

        {/*
          Providers wraps ALL children — this is what makes WagmiProvider available
          to any page that needs wallet features (consent/claim).
          Normie pages (request, upload, sign, review, confirmation) never trigger
          any wagmi hooks so it has zero impact on their performance.
        */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}