"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export function StepShell({
  step,
  total,
  onBack,
  children,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const progress = ((step + 1) / total) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={onBack}
            aria-label="Étape précédente"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-cream/70 transition hover:border-copper/60 hover:text-copper disabled:opacity-0"
            disabled={!onBack}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-hairline/5">
            <motion.div
              className="h-full rounded-full bg-copper-gradient"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className="font-mono text-xs text-muted">
            {step + 1}/{total}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
