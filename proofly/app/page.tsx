'use client';

import Link from 'next/link';
import { getAllStates } from '@/lib/states';
import { saveSession } from '@/lib/session';

export default function ProoflyLanding() {
  const states = getAllStates();

  const handleStateSelect = (code: string) => {
    saveSession({ stateCode: code });
  };

  return (
    <div className="bg-slate-950 text-white min-h-screen">

      {/* Hero */}
      <section className="pt-24 pb-20 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-5xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-3 bg-slate-900 border border-teal-500/30 rounded-full px-6 py-2 mb-8">
            <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-teal-400">Built on Base • Powered by EAS</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-none mb-6">
            One signature.<br />
            <span className="text-teal-400">Reusable forever.</span>
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-4">
            We file your official birth certificate request with the state on your behalf —
            then permanently delete every document with on-chain proof.
          </p>
          <p className="text-sm text-slate-500 mb-12">
            No account. No wallet required. Your data exists for minutes, not years.
          </p>

          {/* State selector */}
          <div className="max-w-md mx-auto mb-8">
            <p className="text-sm text-zinc-400 mb-3">Select your state</p>
            <div className="grid grid-cols-2 gap-3">
              {states.map((s) => (
                <Link
                  key={s.code}
                  href={s.status === 'live' ? '/request' : '#'}
                  onClick={() => s.status === 'live' && handleStateSelect(s.code)}
                  className={`
                    relative rounded-2xl border px-5 py-4 text-left transition
                    ${s.status === 'live'
                      ? 'border-teal-500/50 bg-slate-900 hover:bg-slate-800 hover:border-teal-400 cursor-pointer'
                      : 'border-zinc-800 bg-slate-900/50 cursor-not-allowed opacity-60'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        ~{s.vitalRecords.processingTimeDays} days
                      </p>
                    </div>
                    {s.status === 'live' ? (
                      <span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-1 rounded-full">
                        Live
                      </span>
                    ) : (
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-1 rounded-full">
                        Soon
                      </span>
                    )}
                  </div>
                </Link>
              ))}

              {/* Static "coming soon" states — will be replaced as StateConfig entries are added */}
              {['California', 'Texas', 'New York'].map((name) => (
                <div
                  key={name}
                  className="rounded-2xl border border-zinc-800 bg-slate-900/50 px-5 py-4 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Coming soon</p>
                    </div>
                    <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-1 rounded-full">Soon</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/request"
            onClick={() => handleStateSelect('CO')}
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-10 py-5 rounded-3xl transition-all active:scale-95"
          >
            Start Colorado Request →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { step: '1', title: 'Fill details', desc: 'Name, DOB, parents, address. 2 minutes.' },
              { step: '2', title: 'Upload ID', desc: 'Photo of your driver\'s license. Encrypted immediately.' },
              { step: '3', title: 'E-sign', desc: 'Authorize us to file on your behalf.' },
              { step: '4', title: 'Pay', desc: 'State fee + small service charge. Stripe or USDC.' },
              { step: '5', title: 'Done', desc: 'We mail it. State mails cert to you. We delete everything.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400 font-bold flex items-center justify-center mx-auto mb-3">
                  {step}
                </div>
                <p className="font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy callout */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Privacy isn't a feature. It's the architecture.</h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {[
              {
                icon: '🔒',
                title: 'No database',
                desc: 'Your documents never touch persistent storage. Processed in memory, deleted immediately after mailing.',
              },
              {
                icon: '⛓️',
                title: 'On-chain deletion proof',
                desc: 'A cryptographic hash of every file is published on Base before deletion. Anyone can verify it.',
              },
              {
                icon: '🎭',
                title: 'No wallet required',
                desc: 'Works like a normal form. Blockchain is invisible unless you want the soulbound credential.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAVE Act context */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-block bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-4 mb-6">
            <p className="text-amber-400 text-sm font-medium">⚠️ SAVE Act passed the House — Feb 2026</p>
          </div>
          <h2 className="text-3xl font-bold mb-4">Birth certificates just became urgent</h2>
          <p className="text-zinc-400 mb-8">
            The SAVE Act would require documentary proof of citizenship — like a birth certificate —
            for voter registration. Millions of Americans don't have easy access to theirs.
            Proofly removes that wall.
          </p>
          <Link
            href="/request"
            onClick={() => handleStateSelect('CO')}
            className="inline-flex items-center gap-2 bg-white text-slate-950 font-semibold px-8 py-4 rounded-2xl hover:bg-zinc-100 transition"
          >
            Get your Colorado birth certificate →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-10 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
          <p>© 2026 Hudson R&D. Proofly is a service of Hudson R&D LLC.</p>
          <div className="flex gap-6">
            <a href="https://hudsonrnd.com" className="hover:text-white transition">Hudson R&D</a>
            <a href="/claim" className="hover:text-teal-400 transition">Claim Credentials</a>
          </div>
        </div>
      </footer>
    </div>
  );
}