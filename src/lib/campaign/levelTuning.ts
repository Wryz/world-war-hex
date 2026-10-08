// Per-level fine tuning of enemy strength, measured with the balance simulator
// (npm run simulate -- --tune): each level's strength for its target win rate (targetWinRate in levels.ts) relative to its
// region's typical level. It evens out the luck of each level's roster mix and map.
export const LEVEL_TUNING: readonly number[] = [
  1.12, 1.00, 1.00, 0.98, 0.87, 1.07, 1.00, 0.89, 1.11, 0.76,
  0.83, 0.70, 0.82, 0.91, 0.84, 1.08, 1.28, 1.08, 1.20, 0.70,
  0.99, 1.01, 1.00, 0.97, 0.95, 1.05, 0.91, 1.13, 1.01, 0.87,
  1.03, 1.03, 0.99, 0.97, 0.99, 1.00, 0.94, 0.96, 1.01, 0.89,
  1.33, 0.98, 1.02, 0.84, 0.81, 1.07, 0.93, 1.14, 0.95, 0.92,
  1.13, 0.91, 0.98, 1.15, 0.85, 1.03, 1.11, 0.93, 0.88, 0.78,
  0.85, 1.07, 1.00, 1.00, 0.76, 0.98, 1.02, 1.04, 0.92, 0.93,
  1.12, 0.87, 0.93, 0.95, 0.82, 1.09, 1.05, 1.08, 0.95, 0.82,
  0.99, 1.05, 1.22, 1.00, 1.20, 0.94, 0.99, 1.05, 0.89, 0.97,
  0.85, 0.96, 0.91, 1.08, 0.81, 0.91, 1.19, 1.05, 1.05, 0.87,
];
