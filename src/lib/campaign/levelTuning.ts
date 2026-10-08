// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.02, 0.94, 1.14, 0.98, 0.96, 1.07, 0.89, 0.83, 1.13, 0.85,
  0.72, 0.75, 0.80, 0.93, 0.84, 1.06, 1.26, 1.12, 1.07, 0.74,
  1.00, 1.03, 1.01, 0.92, 0.90, 1.00, 0.98, 1.16, 1.08, 1.12,
  1.09, 1.07, 1.02, 0.91, 0.94, 0.93, 0.97, 0.96, 1.05, 1.00,
  1.40, 0.95, 1.04, 0.97, 0.95, 1.05, 0.90, 1.02, 0.98, 1.04,
  1.00, 1.03, 0.99, 1.15, 1.04, 1.05, 0.99, 0.96, 0.81, 0.81,
  0.78, 1.05, 1.06, 0.80, 0.81, 0.95, 1.05, 0.99, 1.01, 1.04,
  1.15, 0.97, 0.99, 0.93, 1.00, 1.13, 1.06, 0.98, 1.01, 0.88,
  0.83, 1.13, 1.18, 1.06, 0.96, 1.06, 0.94, 0.90, 0.87, 0.93,
  0.82, 0.92, 0.83, 1.05, 0.97, 1.00, 1.03, 1.00, 1.09, 0.78,
];
