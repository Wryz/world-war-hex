'use client';

import React from 'react';
import Link from 'next/link';
import { CARD_CLASS, SECONDARY_BUTTON, SKY_BACKGROUND } from './MenuShell';
import { BackIcon } from '../game/icons';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

// The privacy policy and terms: plain text on a card, with links between the two and back to the game
// (a client component only because the menu styles it shares live beside the profile's hooks)

export const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="font-display mb-2 text-xl text-amber-300">{title}</h2>
    <div className="flex flex-col gap-2 leading-relaxed text-slate-200 [&_a]:text-sky-300 [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc">
      {children}
    </div>
  </section>
);

export const ContactLink: React.FC = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export const LegalPage: React.FC<{ title: string; other: { href: string; label: string }; children: React.ReactNode }> = ({ title, other, children }) => (
  <div className="min-h-screen w-full overflow-x-hidden" style={{ background: SKY_BACKGROUND }}>
    <header className="flex flex-wrap items-center gap-3 pb-4 pl-[calc(0.75rem+var(--safe-l))] pr-[calc(0.75rem+var(--safe-r))] pt-[calc(0.75rem+var(--safe-t))] sm:pl-[calc(1.5rem+var(--safe-l))] sm:pr-[calc(1.5rem+var(--safe-r))]">
      <Link href="/" className={`${SECONDARY_BUTTON} flex items-center gap-1 px-3 py-2 text-base`}>
        <BackIcon /> Game
      </Link>
      <h1
        className="font-display text-3xl text-amber-400 sm:text-4xl"
        style={{ WebkitTextStroke: '2px #0f172a', paintOrder: 'stroke fill', textShadow: '0 4px 0 #0f172a' }}
      >
        {title}
      </h1>
    </header>
    <main className="mx-auto max-w-3xl pb-[calc(4rem+var(--safe-b))] pl-[calc(0.75rem+var(--safe-l))] pr-[calc(0.75rem+var(--safe-r))] sm:pl-[calc(1.5rem+var(--safe-l))] sm:pr-[calc(1.5rem+var(--safe-r))]">
      <article className={`${CARD_CLASS} p-5 text-sm sm:p-7 sm:text-base`}>
        <p className="text-xs uppercase tracking-widest text-slate-400">Last updated {LEGAL_UPDATED}</p>
        {children}
        <p className="mt-8 border-t border-white/10 pt-4 text-sm text-slate-400">
          See also the <Link href={other.href} className="text-sky-300 underline">{other.label}</Link>.
        </p>
      </article>
    </main>
  </div>
);
