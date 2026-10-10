import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink, LegalPage, LegalSection } from '@/components/menu/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service · Hex Hordes',
  description: 'The rules for playing Hex Hordes.',
  alternates: { canonical: '/terms' }
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" other={{ href: '/privacy', label: 'Privacy Policy' }}>
      <p className="mt-3">
        These terms apply to Hex Hordes (&ldquo;the game&rdquo;), its website and its online features. By playing, you agree to
        them. If you don&apos;t agree, please don&apos;t use the game.
      </p>

      <LegalSection title="Playing the game">
        <p>
          You may play the game for your own personal, non-commercial enjoyment. You may not copy, sell or redistribute
          the game, or try to break, overload or gain unauthorised access to it or the services it uses.
        </p>
      </LegalSection>

      <LegalSection title="Coins, cards and other in-game items">
        <p>
          Coins, cards, materials, cosmetics and other in-game items have no real-world value. They can&apos;t be bought,
          sold or exchanged for money, and you don&apos;t own them: you have a licence to use them in the game. We may
          change how they work, for example to rebalance the game.
        </p>
      </LegalSection>

      <LegalSection title="Your saves">
        <p>
          Your progress is stored in your browser, and optionally in the cloud. We do our best to keep it safe, but we
          can&apos;t guarantee that a save will never be lost, so keep a downloaded copy of anything that matters to you.
          A save that has been edited or tampered with may be corrected or refused.
        </p>
      </LegalSection>

      <LegalSection title="Playing with others">
        <ul>
          <li>Choose a display name that isn&apos;t offensive, hateful, misleading or someone else&apos;s.</li>
          <li>Don&apos;t cheat, exploit bugs or use modified saves to spoil a battle for other players.</li>
          <li>Don&apos;t use invite or challenge links to spam or harass anyone.</li>
        </ul>
        <p>We may close rooms or block access for anyone who breaks these rules.</p>
      </LegalSection>

      <LegalSection title="Ads and other services">
        <p>
          The game may show ads and links to services run by others. We aren&apos;t responsible for their content, and your
          use of them is subject to their own terms. How the game uses these services is described in the{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Content and credits">
        <p>
          The game includes art, models, music and fonts made by others and used under their licences; they are credited
          in <b>Stats &amp; Save</b>. Everything else in the game belongs to us or our licensors.
        </p>
      </LegalSection>

      <LegalSection title="Changes and availability">
        <p>
          We may update, change, pause or stop the game or any of its features, including online play and cloud saves,
          at any time. We may update these terms too; the new version will be posted here with a new date, and continuing
          to play means you accept it.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The game is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, to the extent the law
          allows. We don&apos;t promise that it will always be available, free of bugs, or that saves will never be lost.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for any indirect or consequential loss, or for any loss of data
          or in-game items, arising from your use of the game. Nothing in these terms limits any rights you have as a
          consumer that can&apos;t be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms: <ContactLink />.</p>
      </LegalSection>
    </LegalPage>
  );
}
