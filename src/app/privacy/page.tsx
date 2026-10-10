import type { Metadata } from 'next';
import { ContactLink, LegalPage, LegalSection } from '@/components/menu/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy · Hex Hordes',
  description: 'What Hex Hordes stores, what it sends, and the choices you have.',
  alternates: { canonical: '/privacy' }
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" other={{ href: '/terms', label: 'Terms of Service' }}>
      <p className="mt-3">
        Hex Hordes (&ldquo;the game&rdquo;, &ldquo;we&rdquo;) is a strategy game played in your web browser. This policy explains what
        information the game keeps, what it sends to other services, and the choices you have. You can play without
        an account and without telling us who you are.
      </p>

      <LegalSection title="What stays on your device">
        <p>
          Your progress (coins, cards, campaign stars, stats and settings) and any battle in progress are saved in your
          browser&apos;s storage. The game also stores its files on your device so it can be played offline. None of this
          leaves your device unless you use one of the online features below - apart from the anonymous gameplay
          statistics described further down (such as how far you have got and which cards you play). You can download a copy of your save, or
          erase it, in <b>Stats &amp; Save</b>.
        </p>
      </LegalSection>

      <LegalSection title="Online play and cloud save">
        <p>
          When you use <b>Battle Friends</b> or turn on <b>Cloud save</b>, the game creates an anonymous account for your
          device with our database provider, Supabase. That account is identified by a random ID, not by your name.
        </p>
        <ul>
          <li>
            <b>Battle Friends:</b> the room code, the display name you choose, your colour, team and the cards you bring
            are shared with the other players in the room. Your orders during a battle are sent through the room. Rooms
            are deleted automatically after they have been inactive for a while.
          </li>
          <li>
            <b>Cloud save:</b> a copy of your save is kept on our database. If you choose to link an email address - so you
            can restore your save after clearing your browser, or load it on another device - we keep that email address to
            sign you in and send you sign-in links and codes. We don&apos;t send marketing email.
          </li>
        </ul>
        <p>
          You can delete your cloud save at any time in <b>Stats &amp; Save</b> (turn cloud save off on your other devices
          first, or they will save it again). To have your account and email address
          removed entirely, write to <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="Gameplay statistics">
        <p>
          To see where players get stuck and which cards they pick, the game may send anonymous gameplay events (for
          example, &ldquo;level 12 lost after 9 rounds&rdquo;, or &ldquo;card upgraded&rdquo;) and page views to PostHog and/or Google
          Analytics. These services may set a cookie or local identifier to tell visits apart, and they receive your
          IP address as part of any web request. We don&apos;t record your screen and don&apos;t send your name or email address.
          PostHog records only the game events above and respects your browser&apos;s Do Not Track setting; Google Analytics
          may also note how far you scroll and links you follow out of the game, with Google signals and ad
          personalisation switched off. You can switch these statistics off in <b>Settings → Gameplay</b>.
        </p>
      </LegalSection>

      <LegalSection title="Advertising">
        <p>
          The free web version may show ads from Google (AdSense / H5 Games Ads): an optional ad you can watch for bonus
          coins, and occasional ads between battles. Google and its partners may use cookies or similar technologies to
          show ads, measure them and prevent fraud, and depending on your choices may personalise them. Where the law
          requires it (for example in the EEA, the UK and Switzerland), you are asked for consent through Google&apos;s
          consent message first. Learn more at{' '}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            how Google uses information from sites that use its services
          </a>
          , and manage ad personalisation at{' '}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="Hosting">
        <p>
          Like any website, the servers that deliver the game see your IP address and basic request details (such as your
          browser type) and may keep them briefly in logs for security and to keep the service running.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <p>
          We use this information to run the game and its online features (to provide the service you asked for). Gameplay
          statistics are collected to understand and improve the game (our legitimate interest): they are on unless you
          switch them off in Settings. Ads fund the game; where the law requires it, ads and their cookies wait for your
          consent through Google&apos;s consent message. We don&apos;t sell your personal information.
        </p>
      </LegalSection>

      <LegalSection title="How long it is kept">
        <p>
          Saves on your device stay until you erase them or clear your browser. Cloud saves are kept until you delete them,
          or after two years without use. Online rooms are removed once they are no longer used. Analytics and advertising
          providers keep data according to their own policies.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li>Switch off gameplay statistics in Settings, and manage ad cookies through the consent message or your browser.</li>
          <li>Download, erase or delete your save and cloud save in Stats &amp; Save.</li>
          <li>
            Depending on where you live, you may have the right to access, correct, delete or move your personal information,
            or to object to how it is used. Write to <ContactLink /> and we will help. You can also complain to your local
            data protection authority.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The game is not directed at children under 13, and we don&apos;t knowingly collect personal information from them.
          If you believe a child has given us an email address, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this policy changes, the new version will be posted on this page with a new date. Significant changes will
          also be pointed out in the game.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions or requests about your privacy: <ContactLink />.</p>
      </LegalSection>
    </LegalPage>
  );
}
