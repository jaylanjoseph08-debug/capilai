"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { runAnalysisPipeline, type AnalysisSource } from "@/lib/mockAnalysis";
import { getPipelineSteps } from "@/lib/i18n";
import { useHairAIStore } from "@/lib/store";
import { useTranslation } from "@/lib/useTranslation";
import { useSelectedPlan } from "@/lib/useSelectedPlan";
import { pricingUrlForScanLimit, loginUrlForScan } from "@/lib/hairScanQuota";
import { useHairScanQuota } from "@/lib/useHairScanQuota";
import { hasPaidAccess } from "@/lib/subscriptionAccess";
import { loadCapturedVideo, clearCapturedVideo } from "@/lib/videoStorage";
import { saveProfileToServer } from "@/lib/hairProfileSync";

export default function AnalyzingPage() {
  const router = useRouter();
  const { locale, hydrated, t } = useTranslation();
  const { answers, setProfile } = useHairAIStore();
  const plan = useSelectedPlan();
  const { ready, canStart, requiresAuth, consume } = useHairScanQuota();
  const planRef = useRef(plan);
  planRef.current = plan;
  const [activeStep, setActiveStep] = useState(-1);
  const [frameProgress, setFrameProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<AnalysisSource | null>(null);
  const [done, setDone] = useState(false);
  const steps = getPipelineSteps(locale);

  useEffect(() => {
    if (!hydrated || !ready) return;

    let cancelled = false;

    async function runAnalysis() {
      const activePlan = planRef.current;
      if (requiresAuth) {
        router.replace(loginUrlForScan());
        return;
      }
      if (!canStart) {
        router.replace(pricingUrlForScanLimit(activePlan));
        return;
      }

      setError("");
      setSource(null);
      setFrameProgress(null);

      let videoBlob: Blob | undefined;
      try {
        videoBlob = (await loadCapturedVideo()) ?? undefined;
        if (videoBlob) await clearCapturedVideo();
      } catch (err) {
        console.warn("Could not load captured video:", err);
      }

      try {
        const result = await runAnalysisPipeline(
          answers,
          (index) => {
            if (!cancelled) setActiveStep(index);
          },
          videoBlob,
          locale,
          (progress) => {
            if (cancelled) return;
            if (progress.stage === "frames") {
              setFrameProgress({ current: progress.current, total: progress.total });
            }
            if (progress.stage === "pipeline") {
              setActiveStep(progress.index);
            }
          }
        );

        if (cancelled) return;

        setSource(result.source);
        setProfile(result.profile);
        const snapshot = useHairAIStore.getState();
        await saveProfileToServer({
          answers: snapshot.answers,
          profile: snapshot.profile,
          history: snapshot.history,
        });
        await consume();
        if (hasPaidAccess(planRef.current)) {
          router.replace("/dashboard");
        } else {
          router.replace("/pricing?from=diagnostic");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("analyzing.error"));
      }
    }

    runAnalysis();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, locale, ready, canStart, requiresAuth]);

  const fallbackMessage =
    source === "mock-fallback"
      ? t("analyzing.fallbackAiFailed")
      : source === "mock"
        ? t("analyzing.fallbackMock")
        : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-radial px-6">
      <div className="mb-10 flex flex-col items-center">
        <div className="relative mb-6 h-24 w-24">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-copper/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="absolute inset-3 rounded-full bg-copper-gradient" />
        </div>
        <h1 className="font-display text-2xl font-medium text-cream">{t("analyzing.title")}</h1>
        <p className="mt-1 font-body text-sm text-muted">
          {error
            ? t("analyzing.errorSubtitle")
            : frameProgress
              ? t("analyzing.extractingFrames")
                  .replace("{current}", String(frameProgress.current))
                  .replace("{total}", String(frameProgress.total))
              : done
                ? t("analyzing.complete")
                : t("analyzing.subtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex max-w-xs items-start gap-2 rounded-2xl border border-copper/30 bg-copper/10 p-4">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-copper-light" />
          <div>
            <p className="font-body text-xs text-cream/80">{error}</p>
            <button
              onClick={() => router.push("/scan")}
              className="mt-2 font-body text-xs text-copper-light underline underline-offset-2"
            >
              {t("analyzing.retry")}
            </button>
          </div>
        </div>
      )}

      {fallbackMessage && !error && done && (
        <p className="mb-4 max-w-xs text-center font-body text-[11px] text-muted">{fallbackMessage}</p>
      )}

      {source === "ai" && done && !error && (
        <p className="mb-4 max-w-xs text-center font-body text-[11px] text-copper-light">{t("analyzing.aiSuccess")}</p>
      )}

      <ul className="w-full max-w-xs space-y-3">
        {steps.map((label, i) => {
          const stepDone = i < activeStep || done;
          const current = i === activeStep && !done && !error;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  stepDone
                    ? "border-copper bg-copper text-ink"
                    : current
                      ? "border-copper text-copper"
                      : "border-hairline/15 text-transparent"
                }`}
              >
                {stepDone && <Check size={11} />}
                {current && !stepDone && (
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-copper"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                )}
              </span>
              <span
                className={`font-body text-sm transition ${
                  stepDone ? "text-cream/50 line-through" : current ? "text-cream" : "text-muted"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
