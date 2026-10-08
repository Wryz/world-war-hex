// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.01, 0.86, 0.91, 0.95, 0.87, 1.01, 1.06, 1.00, 1.15, 0.84,
  0.73, 0.77, 0.82, 0.93, 0.88, 1.08, 1.31, 1.11, 1.16, 0.70,
  0.98, 1.00, 1.02, 0.99, 0.94, 1.01, 0.93, 1.08, 1.03, 0.90,
  1.03, 1.12, 1.00, 1.05, 0.92, 0.94, 0.94, 0.90, 1.01, 0.90,
  1.37, 0.98, 1.02, 0.82, 0.78, 1.07, 0.86, 0.87, 1.01, 0.82,
  1.06, 0.93, 0.79, 1.23, 1.06, 1.07, 1.03, 0.98, 0.71, 0.70,
  0.92, 1.00, 1.08, 0.94, 0.78, 1.08, 1.02, 0.97, 1.12, 0.90,
  1.18, 0.92, 0.90, 1.03, 0.91, 1.12, 0.98, 1.01, 0.98, 0.78,
  0.84, 1.05, 1.04, 0.99, 1.03, 1.01, 0.98, 0.92, 1.08, 0.85,
  0.92, 0.90, 0.91, 1.10, 0.94, 0.83, 1.09, 1.08, 1.10, 0.74,
];
