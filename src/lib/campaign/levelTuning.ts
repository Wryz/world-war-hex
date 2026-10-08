// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.12, 0.96, 0.92, 1.04, 1.00, 0.86, 0.94, 0.97, 1.26, 0.86,
  0.76, 0.76, 0.72, 0.95, 0.90, 1.15, 1.31, 1.06, 1.15, 0.70,
  0.99, 1.01, 1.00, 0.96, 0.88, 1.05, 0.94, 1.12, 1.04, 1.16,
  1.03, 1.00, 0.95, 1.00, 0.92, 0.96, 0.83, 1.04, 1.07, 0.95,
  1.24, 0.98, 1.02, 1.01, 0.88, 1.03, 0.91, 0.99, 0.86, 0.96,
  1.01, 0.78, 0.91, 1.04, 0.99, 1.02, 1.06, 0.84, 0.99, 0.77,
  0.77, 1.01, 0.93, 0.90, 0.79, 1.01, 0.99, 1.12, 1.13, 1.08,
  1.11, 1.02, 0.82, 0.99, 0.85, 1.09, 1.05, 0.96, 0.95, 0.93,
  0.85, 0.98, 1.15, 1.03, 0.92, 0.83, 1.03, 1.03, 0.96, 0.96,
  0.84, 0.81, 0.88, 1.10, 1.07, 1.12, 1.00, 1.00, 1.10, 0.89,
];
