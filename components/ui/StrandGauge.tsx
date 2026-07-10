"use client";

import { motion } from "framer-motion";

/**
 * StrandGauge — the app's signature visual.
 * Instead of a generic single-stroke progress ring, the score is expressed
 * as a bundle of individual "strands" arcing around the circle, each one
 * animating in with a slight stagger — evoking hair itself rather than a
 * generic dashboard widget.
 */
export function StrandGauge({
  score,
  size = 220,
  strands = 14,
  label = "Score capillaire",
}: {
  score: number;
  size?: number;
  strands?: number;
  label?: string;
}) {
  const radius = size / 2 - 14;
  const center = size / 2;
  const activeStrands = Math.round((score / 100) * strands);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {Array.from({ length: strands }).map((_, i) => {
          const gapDeg = 3;
          const arcDeg = 360 / strands - gapDeg;
          const startDeg = i * (360 / strands);
          const isActive = i < activeStrands;
          return (
            <motion.path
              key={i}
              d={describeArc(center, center, radius, startDeg, startDeg + arcDeg)}
              fill="none"
              stroke={isActive ? "url(#strandGradient)" : "rgb(var(--text) / 0.1)"}
              strokeWidth={isActive ? 6 : 4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: i * 0.035, duration: 0.5, ease: "easeOut" }}
            />
          );
        })}
        <defs>
          <linearGradient id="strandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C97C4B" />
            <stop offset="100%" stopColor="#E8B86D" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-5xl font-semibold text-cream"
        >
          {score}
        </motion.span>
        <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{label}</span>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
