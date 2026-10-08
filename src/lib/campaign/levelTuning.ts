// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.00, 0.89, 0.95, 0.84, 0.74, 0.93, 0.92, 0.90, 0.91, 0.77,
  0.71, 0.68, 0.75, 0.94, 0.74, 1.04, 1.36, 1.23, 1.28, 0.66,
  0.98, 1.00, 1.00, 0.97, 0.92, 1.05, 0.90, 1.12, 1.06, 0.86,
  1.00, 1.05, 1.17, 0.99, 0.88, 0.90, 1.00, 0.98, 1.11, 0.89,
  1.38, 0.97, 1.08, 1.05, 0.82, 1.00, 0.89, 1.00, 0.86, 0.88,
  1.02, 0.89, 0.88, 0.99, 1.03, 1.14, 1.26, 0.98, 1.02, 0.81,
  0.88, 1.18, 1.14, 0.92, 0.82, 0.92, 0.94, 1.06, 1.12, 0.90,
  1.11, 0.85, 0.87, 0.99, 0.88, 1.04, 1.01, 1.01, 0.78, 0.70,
  0.87, 1.08, 1.07, 1.15, 0.86, 0.97, 1.02, 0.99, 0.87, 0.81,
  0.93, 1.09, 0.88, 1.00, 0.97, 1.07, 0.83, 1.01, 1.09, 0.77,
];
