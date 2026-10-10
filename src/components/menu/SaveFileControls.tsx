import React, { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { isStoragePersisted } from '@/lib/offline';
import { exportSave, parseSave, replaceProfile, resetProfile } from '@/lib/meta/profile';
import { clearSavedGame, readRawSave, writeRawSave } from '../game/storage/GameStorage';
import { SECONDARY_BUTTON } from './MenuShell';
import { DownloadIcon, TrashIcon, UploadIcon } from '../game/icons';

// The player's save: progress lives in this browser (battles save themselves each turn and when left),
// and can be downloaded to a file to back it up or move it, loaded back from one, or erased.
// Shown in Stats & Save and in Settings.
export const SaveFileControls: React.FC<{ title: React.ReactNode }> = ({ title }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  // Read in the browser only, so the server render matches
  const [savesProtected, setSavesProtected] = useState<boolean | null>(null);
  useEffect(() => {
    void isStoragePersisted().then(setSavesProtected);
  }, []);

  const handleExport = () => {
    const blob = new Blob([exportSave(readRawSave())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hex-hordes-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    trackEvent('save_exported');
    setMessage({ text: 'Save file downloaded. Keep it somewhere safe!' });
  };

  const handleImport = async (file: File) => {
    const parsed = parseSave(await file.text());
    if (!parsed) {
      setMessage({ text: 'That file isn\'t a Hex Hordes save.', isError: true });
      return;
    }
    if (!window.confirm('Load this save? Your current progress on this computer will be replaced.')) return;
    replaceProfile(parsed.profile);
    writeRawSave(parsed.battle);
    trackEvent('save_imported');
    setMessage({ text: 'Save loaded. Welcome back, commander!' });
  };

  const handleReset = () => {
    if (!window.confirm('Erase all progress (coins, cards, stars and stats)? This cannot be undone.')) return;
    resetProfile();
    clearSavedGame();
    setMessage({ text: 'Progress erased. A fresh campaign awaits.' });
  };

  return (
    <div>
      {title}
      <p className="mt-1 text-xs text-slate-400">
        Progress saves in this browser, and a battle saves itself every turn and when you leave it. Download a save file to
        back it up or move it to another computer.
      </p>
      {savesProtected !== null && (
        <p className={`mt-1 text-xs ${savesProtected ? 'text-emerald-300' : 'text-slate-400'}`}>
          {savesProtected
            ? 'Protected from browser clean-up.'
            : 'Your browser may clear this if space runs low - keep a backup.'}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={handleExport} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}>
          <DownloadIcon /> Download save
        </button>
        <button onClick={() => fileInputRef.current?.click()} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 text-sm`}>
          <UploadIcon /> Load save file
        </button>
        <button onClick={handleReset} className={`${SECONDARY_BUTTON} flex items-center gap-1.5 bg-red-900 text-sm hover:bg-red-800`}>
          <TrashIcon /> Erase progress
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className={`mt-3 text-sm font-semibold ${message.isError ? 'text-red-400' : 'text-emerald-300'}`} role="status">{message.text}</p>
      )}
    </div>
  );
};
