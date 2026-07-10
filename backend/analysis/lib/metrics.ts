export type HairMetrics = {
  health: number;
  hydration: number;
  density: number;
  porosity: number;
  volume: number;
  thickness: number;
  elasticity: number;
  scalp: number;
};

export function clampMetric(value: unknown, fallback = 70): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function normalizeMetrics(raw: Record<string, unknown>): HairMetrics {
  return {
    health: clampMetric(raw.health),
    hydration: clampMetric(raw.hydration),
    density: clampMetric(raw.density),
    porosity: clampMetric(raw.porosity),
    volume: clampMetric(raw.volume),
    thickness: clampMetric(raw.thickness),
    elasticity: clampMetric(raw.elasticity),
    scalp: clampMetric(raw.scalp),
  };
}

export function averageScore(metrics: HairMetrics): number {
  const values = Object.values(metrics);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
