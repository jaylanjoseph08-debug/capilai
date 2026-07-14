"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { StepShell } from "@/components/ui/StepShell";
import { getQuestions } from "@/lib/questions";
import { useHairAIStore } from "@/lib/store";
import { useTranslation } from "@/lib/useTranslation";
import { useAuthStore } from "@/lib/authStore";
import { DIAGNOSIS_SIGNUP_PATH } from "@/lib/postAuthRedirect";
import { hasPrivateAccess } from "@/lib/privateAccess";

export default function OnboardingPage() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const questions = getQuestions(locale);
  const [step, setStep] = useState(0);
  const { answers, setAnswer } = useHairAIStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isConfigured = useAuthStore((s) => s.isConfigured);

  useEffect(() => {
    if (hasPrivateAccess()) return;
    if (isLoading) return;
    if (isConfigured && !isAuthenticated) {
      router.replace(DIAGNOSIS_SIGNUP_PATH);
    }
  }, [isAuthenticated, isConfigured, isLoading, router]);

  if (!hasPrivateAccess() && isConfigured && (isLoading || !isAuthenticated)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-radial px-6">
        <p className="font-body text-sm text-muted">…</p>
      </main>
    );
  }

  const question = questions[step];
  const isLast = step === questions.length - 1;
  const currentValue = answers[question.id];

  function goNext() {
    if (isLast) {
      router.push("/scan");
    } else {
      setStep((s) => s + 1);
    }
  }

  function selectSingle(value: string) {
    setAnswer(question.id, value);
    setTimeout(goNext, 220);
  }

  function toggleMulti(value: string) {
    const list = Array.isArray(currentValue) ? [...currentValue] : [];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    setAnswer(question.id, next);
  }

  return (
    <StepShell
      step={step}
      total={questions.length}
      onBack={step > 0 ? () => setStep((s) => s - 1) : () => router.push("/")}
    >
      <h2 className="font-display text-3xl font-medium leading-tight text-cream">{question.title}</h2>
      {question.subtitle && <p className="mt-2 font-body text-sm text-muted">{question.subtitle}</p>}

      <div className="mt-8 flex flex-1 flex-col gap-3">
        {question.type === "single" &&
          question.options?.map((opt) => (
            <OptionButton
              key={opt.value}
              label={opt.label}
              selected={currentValue === opt.value}
              onClick={() => selectSingle(opt.value)}
            />
          ))}

        {question.type === "multi" &&
          question.options?.map((opt) => (
            <OptionButton
              key={opt.value}
              label={opt.label}
              selected={Array.isArray(currentValue) && currentValue.includes(opt.value)}
              onClick={() => toggleMulti(opt.value)}
              multi
            />
          ))}

        {question.type === "slider" && (
          <div className="flex flex-1 flex-col items-center justify-center py-10">
            <span className="font-display text-6xl font-semibold text-copper-light">
              {typeof currentValue === "number" ? currentValue : question.min}
            </span>
            <span className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">{question.unit}</span>
            <input
              type="range"
              min={question.min}
              max={question.max}
              step={question.step}
              value={typeof currentValue === "number" ? currentValue : question.min}
              onChange={(e) => setAnswer(question.id, Number(e.target.value))}
              className="mt-8 w-full accent-copper"
            />
          </div>
        )}
      </div>

      {(question.type === "multi" || question.type === "slider") && (
        <button
          onClick={goNext}
          className="mt-8 flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
        >
          {isLast ? t("onboarding.goToScan") : t("onboarding.continue")}
        </button>
      )}
    </StepShell>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  multi,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`flex h-14 items-center justify-between rounded-2xl border px-5 text-left font-body text-sm transition ${
        selected
          ? "border-copper/60 bg-copper/10 text-cream"
          : "border-line text-cream/80 hover:border-hairline/20"
      }`}
    >
      {label}
      {multi && (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
            selected ? "border-copper bg-copper text-ink" : "border-hairline/20"
          }`}
        >
          {selected && <Check size={12} />}
        </span>
      )}
    </motion.button>
  );
}
