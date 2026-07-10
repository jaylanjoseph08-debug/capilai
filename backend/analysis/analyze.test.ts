import { describe, expect, it } from "vitest";
import { averageScore, clampMetric, normalizeMetrics } from "./lib/metrics";

describe("metrics helpers", () => {
  it("clamps values between 0 and 100", () => {
    expect(clampMetric(120)).toBe(100);
    expect(clampMetric(-5)).toBe(0);
    expect(clampMetric("72")).toBe(72);
    expect(clampMetric("invalid", 55)).toBe(55);
  });

  it("normalizes partial metric payloads", () => {
    const metrics = normalizeMetrics({ health: 80, hydration: 65 });
    expect(metrics.health).toBe(80);
    expect(metrics.hydration).toBe(65);
    expect(metrics.density).toBe(70);
  });

  it("computes average score", () => {
    const metrics = normalizeMetrics({
      health: 80,
      hydration: 60,
      density: 70,
      porosity: 70,
      volume: 70,
      thickness: 70,
      elasticity: 70,
      scalp: 70,
    });
    expect(averageScore(metrics)).toBe(70);
  });
});
