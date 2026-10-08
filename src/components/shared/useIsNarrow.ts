import { useSyncExternalStore } from 'react';

// Phones: screens narrow enough that cards and panels switch to their compact sizes
const NARROW_QUERY = '(max-width: 520px)';

const subscribeToWidth = (listener: () => void) => {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

export const useIsNarrow = () =>
  useSyncExternalStore(subscribeToWidth, () => window.matchMedia(NARROW_QUERY).matches, () => false);
