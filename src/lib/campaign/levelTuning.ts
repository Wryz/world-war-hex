// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.19, 0.87, 0.96, 1.03, 0.99, 1.05, 1.10, 0.96, 0.97, 1.02,
  0.74, 0.85, 0.85, 1.00, 0.89, 1.00, 1.29, 1.05, 1.19, 0.72,
  0.99, 1.02, 0.98, 0.97, 0.89, 1.05, 0.97, 1.10, 1.07, 1.22,
  1.13, 1.06, 1.04, 0.99, 0.96, 0.98, 0.99, 1.01, 1.00, 1.07,
  1.40, 0.94, 0.98, 0.94, 0.87, 1.18, 1.01, 1.02, 0.91, 1.04,
  0.94, 0.94, 0.81, 1.10, 0.95, 1.06, 1.01, 1.00, 1.00, 0.82,
  0.77, 0.99, 1.03, 0.77, 0.75, 0.90, 1.02, 1.03, 1.01, 0.94,
  1.20, 1.03, 0.98, 0.92, 0.95, 1.07, 0.89, 1.15, 0.94, 0.92,
  0.87, 1.01, 1.14, 0.97, 1.03, 1.14, 1.15, 1.00, 0.82, 0.99,
  0.87, 0.98, 0.98, 1.16, 0.97, 1.18, 0.94, 1.14, 1.03, 0.94,
];
