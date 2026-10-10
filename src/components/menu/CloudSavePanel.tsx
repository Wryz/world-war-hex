import React, { useEffect, useState } from 'react';
import {
  deleteCloudSave, disableCloudSave, dismissCloudNotice, enableCloudSave, linkEmail, sendSignInEmail, signOutCloud, sync, useCloudSave,
  verifyEmailCode
} from '@/lib/cloudSave';
import { SECONDARY_BUTTON } from './MenuShell';
import { CloudIcon, MailIcon, ResumeIcon, TrashIcon } from '../game/icons';

const INPUT = 'min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400';

const timeAgo = (iso: string | undefined, now: number) => {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
};

// An email address to send a link and code to, then the code from the email
const EmailForm: React.FC<{
  purpose: 'link' | 'signin';
  intro: string;
  button: string;
  initialEmail?: string;
  onDone?: () => void;
}> = ({ purpose, intro, button, initialEmail = '', onDone }) => {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(!!initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const error = purpose === 'link' ? await linkEmail(email) : await sendSignInEmail(email);
    setBusy(false);
    if (error) setMessage({ text: error, isError: true });
    else {
      setSent(true);
      setMessage({ text: `Sent! Open the link in the email to ${email.trim()}, or type its code below.`, isError: false });
    }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const error = await verifyEmailCode(email, code, purpose);
    setBusy(false);
    if (error) setMessage({ text: error, isError: true });
    else {
      setMessage({ text: purpose === 'link' ? 'Email linked.' : 'Signed in - your save is loading.', isError: false });
      onDone?.();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400">{intro}</p>
      <form onSubmit={send} className="flex flex-wrap gap-2">
        <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className={INPUT} aria-label="Email address" />
        <button type="submit" disabled={busy} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}><MailIcon /> {button}</button>
      </form>
      {sent && (
        <form onSubmit={verify} className="flex flex-wrap gap-2">
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} placeholder="Code from the email" className={INPUT} aria-label="Code from the email" />
          <button type="submit" disabled={busy} className={`${SECONDARY_BUTTON} text-sm`}>Confirm</button>
        </form>
      )}
      {message && <p className={`text-xs font-semibold ${message.isError ? 'text-red-400' : 'text-emerald-300'}`} role="status">{message.text}</p>}
    </div>
  );
};

// Cloud save in Stats & Save: turn it on or off, see when it last saved, link an email to load the
// save on another device, or sign in to load one here
export const CloudSavePanel: React.FC = () => {
  const cloud = useCloudSave();
  const [now, setNow] = useState(() => Date.now());
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const status = {
    off: null,
    syncing: <span className="text-slate-300">Saving…</span>,
    synced: <span className="text-emerald-300">Saved to the cloud {timeAgo(cloud.syncedAt, now)}</span>,
    offline: <span className="text-amber-300">Offline - it will save when you&apos;re back online</span>,
    error: <span className="text-red-400">Couldn&apos;t reach the cloud{cloud.error ? ` (${cloud.error})` : ''} - trying again soon</span>,
    conflict: <span className="text-amber-300">Choose which save to keep</span>
  }[cloud.status];

  const remove = async () => {
    if (!window.confirm('Delete your save from the cloud and stop saving there? The progress on this device stays. Turn cloud save off on your other devices first, or they will save it again.')) return;
    setBusy(true);
    await deleteCloudSave();
    setBusy(false);
  };

  return (
    <div className="mt-4 rounded-xl bg-slate-800/70 p-3">
      {cloud.notice && (
        <p className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200" role="status">
          {cloud.notice}
          <button onClick={dismissCloudNotice} className="shrink-0 text-amber-100 hover:underline">OK</button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl"><CloudIcon /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-slate-100">Cloud save</b>
          <span className="block text-xs">
            {cloud.enabled ? status : <span className="text-slate-400">Keep a copy of your progress online. Link an email too, to get it back after clearing your browser or play it on another device.</span>}
          </span>
        </div>
        {cloud.enabled ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { void sync(); }} disabled={cloud.status === 'syncing'} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}>
              <ResumeIcon /> Sync now
            </button>
            <button onClick={disableCloudSave} className={`${SECONDARY_BUTTON} text-sm`}>Turn off</button>
          </div>
        ) : (
          <button
            onClick={async () => { setBusy(true); await enableCloudSave(); setBusy(false); }}
            disabled={busy}
            className={`${SECONDARY_BUTTON} bg-sky-700 text-sm hover:bg-sky-600`}
          >
            Turn on
          </button>
        )}
      </div>

      {cloud.enabled && (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm">
          {cloud.email ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-xs text-slate-300">
                Linked to <b className="text-slate-100">{cloud.email}</b>. Sign in with it on another device to play this save there.
              </span>
              <button onClick={() => { void signOutCloud(); }} className={`${SECONDARY_BUTTON} text-sm`}>Sign out</button>
            </div>
          ) : (
            <EmailForm
              key={cloud.pendingEmail ?? 'link'}
              purpose="link"
              intro={cloud.pendingEmail
                ? `Waiting for you to confirm ${cloud.pendingEmail} - open the link in the email, or type its code.`
                : 'Link an email address to get this save back if your browser is cleared, or to play it on another device (sign in with the email there).'}
              button="Link email"
              initialEmail={cloud.pendingEmail}
            />
          )}
          <button onClick={remove} disabled={busy} className="mt-3 flex items-center gap-1 text-xs text-red-300 hover:underline">
            <TrashIcon /> Delete my cloud save
          </button>
        </div>
      )}

      {!cloud.email && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {showSignIn ? (
            <EmailForm
              purpose="signin"
              intro="Load a save from another device: enter the email address linked to it, and we'll send a sign-in link and code."
              button="Send sign-in link"
              onDone={() => setShowSignIn(false)}
            />
          ) : (
            <button onClick={() => setShowSignIn(true)} className="text-xs font-semibold text-sky-300 hover:underline">
              Load my save on this device…
            </button>
          )}
        </div>
      )}
    </div>
  );
};
