import React, { useEffect, useState } from 'react';
import { PANEL_CLASS } from './styles';

interface CollapsiblePanelProps {
  // Used to remember whether the panel was open between visits
  id: string;
  title: React.ReactNode;
  defaultOpen?: boolean;
  // Shown under the header while the panel is collapsed
  collapsedPreview?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const storageKey = (id: string) => `wwh-panel-${id}`;

// HUD panel with a header that expands and collapses its contents
export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  id,
  title,
  defaultOpen = false,
  collapsedPreview,
  className = '',
  children
}) => {
  const [open, setOpen] = useState(defaultOpen);

  // Restore the remembered state after mount (storage isn't available during server rendering)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(id));
      if (saved !== null) setOpen(saved === '1');
    } catch {
      // Storage can be unavailable (private mode); fall back to the default
    }
  }, [id]);

  const toggle = () => {
    setOpen(current => {
      try {
        localStorage.setItem(storageKey(id), current ? '0' : '1');
      } catch {
        // Ignore storage errors - the panel still works for this session
      }
      return !current;
    });
  };

  return (
    <div className={`${PANEL_CLASS} pointer-events-auto text-xs ${className}`}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{title}</span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open ? (
        <div className="px-3 pb-3">{children}</div>
      ) : (
        collapsedPreview && <div className="px-3 pb-2 -mt-1">{collapsedPreview}</div>
      )}
    </div>
  );
};
