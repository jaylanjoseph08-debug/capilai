"use client";

import { motion } from "framer-motion";

export function MetricCard({
  label,
  value,
  hint,
  delay = 0,
}: {
  label: string;
  value: number;
  hint: string;
  delay?: number;
}) {
  const tone = value > 70 ? "#8FBF8A" : value > 45 ? "#E8B86D" : "#D97757";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass rounded-3xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-body text-sm text-cream/80">{label}</span>
        <span className="font-mono text-xs text-muted">{value}/100</span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-hairline/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: delay + 0.1, duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: tone }}
        />
      </div>
      <p className="font-body text-xs leading-relaxed text-muted">{hint}</p>
    </motion.div>
  );
}
