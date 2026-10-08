// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.14, 0.88, 0.91, 0.97, 0.91, 1.00, 1.03, 1.00, 1.12, 0.88,
  0.79, 0.70, 0.70, 1.02, 0.78, 0.99, 1.36, 1.20, 1.14, 0.70,
  0.99, 1.01, 0.95, 0.98, 0.88, 1.05, 0.97, 1.12, 1.01, 0.93,
  1.02, 0.99, 1.01, 0.88, 0.74, 1.00, 0.93, 1.02, 1.08, 0.85,
  1.40, 1.03, 1.07, 0.97, 0.86, 1.02, 0.89, 0.90, 0.87, 0.86,
  0.90, 1.02, 0.96, 1.12, 0.99, 0.97, 0.99, 1.14, 1.01, 0.70,
  0.72, 1.08, 0.95, 0.84, 0.70, 0.86, 1.08, 1.05, 1.06, 0.87,
  1.08, 0.87, 0.97, 0.88, 0.89, 1.09, 1.02, 0.99, 1.12, 0.72,
  0.79, 1.00, 1.01, 0.93, 0.98, 1.11, 1.00, 1.04, 0.93, 1.00,
  0.82, 0.91, 0.76, 1.09, 1.04, 1.13, 0.91, 1.12, 1.09, 0.85,
];
