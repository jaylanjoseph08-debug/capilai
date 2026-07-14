"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, ScanLine, Sparkles, PackagePlus, RotateCcw } from "lucide-react";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { StrandGauge } from "@/components/ui/StrandGauge";
import { lookupProductByBarcode } from "@/lib/products";
import { analyzeProductWithAI } from "@/lib/compatibility";
import { useHairAIStore } from "@/lib/store";
import { useScannerStore, type ScanRecord } from "@/lib/scannerStore";
import { getDemoCodes } from "@/lib/i18n";
import { hasPaidAccess } from "@/lib/subscriptionAccess";
import { useSelectedPlan } from "@/lib/useSelectedPlan";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

type Phase = "scan" | "loading" | "result" | "not_found";

export default function ScannerPage() {
  const router = useRouter();
  const plan = useSelectedPlan();
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { profile, answers } = useHairAIStore();
  const { history, closet, addScan, addToCloset } = useScannerStore();
  const demoCodes = getDemoCodes(locale);

  const [phase, setPhase] = useState<Phase>("scan");
  const [manualCode, setManualCode] = useState("");
  const [current, setCurrent] = useState<ScanRecord | null>(null);
  const [notFoundCode, setNotFoundCode] = useState("");

  async function handleDetected(code: string) {
    if (phase === "loading") return;
    setPhase("loading");
    const product = await lookupProductByBarcode(code);
    if (!product) {
      setNotFoundCode(code);
      setPhase("not_found");
      return;
    }
    const compatibility = await analyzeProductWithAI(product, profile, answers, locale);
    const record: ScanRecord = { product, compatibility, scannedAt: new Date().toISOString() };
    addScan(record);
    if (hasPaidAccess(plan)) {
      setCurrent(record);
      setPhase("result");
      return;
    }
    router.replace("/pricing");
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code.length < 4) return;
    handleDetected(code);
  }

  function openRecord(record: ScanRecord) {
    if (hasPaidAccess(plan)) {
      setCurrent(record);
      setPhase("result");
      return;
    }
    router.replace("/pricing");
  }

  function reset() {
    setPhase("scan");
    setManualCode("");
    setCurrent(null);
  }

  const inCloset = current ? closet.some((r) => r.product.barcode === current.product.barcode) : false;

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("scanner.title")}</span>
        </div>

        <AnimatePresence mode="wait">
          {(phase === "scan" || phase === "not_found") && (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BarcodeScanner active={phase === "scan" || phase === "not_found"} onDetected={handleDetected} />

              {phase === "not_found" && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-copper/30 bg-copper/10 p-4">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-copper-light" />
                  <p className="font-body text-xs leading-relaxed text-cream/80">
                    {(() => {
                      const [before, after] = t("scanner.notFound").split("{code}");
                      return (
                        <>
                          {before}
                          <span className="font-mono">{notFoundCode}</span>
                          {after}
                        </>
                      );
                    })()}
                  </p>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="mt-5 flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={t("scanner.barcodePlaceholder")}
                  className="h-12 flex-1 rounded-2xl border border-line bg-surface px-4 font-mono text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex h-12 items-center justify-center rounded-2xl bg-copper-gradient px-5 font-body text-sm font-semibold text-ink transition active:scale-95"
                >
                  <ScanLine size={16} />
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="w-full font-mono text-[10px] uppercase tracking-widest text-muted">
                  {t("scanner.testWithoutCamera")}
                </span>
                {demoCodes.map((d) => (
                  <button
                    key={d.code}
                    onClick={() => handleDetected(d.code)}
                    className="rounded-full border border-line px-3 py-1.5 font-body text-xs text-cream/70 transition hover:border-copper/50 hover:text-copper-light"
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {history.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-3 font-display text-lg text-cream">{t("scanner.recentScans")}</h2>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 5).map((r) => (
                      <button
                        key={r.product.barcode + r.scannedAt}
                        onClick={() => openRecord(r)}
                        className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:border-copper/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm text-cream">{r.product.name}</p>
                          <p className="truncate font-body text-xs text-muted">{r.product.brand}</p>
                        </div>
                        <ScoreBadge score={r.compatibility.score} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <motion.div
                className="mb-5 h-14 w-14 rounded-full bg-copper-gradient"
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
              <p className="font-body text-sm text-muted">{t("scanner.analyzingComposition")}</p>
            </motion.div>
          )}

          {phase === "result" && current && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ProductResult
                record={current}
                inCloset={inCloset}
                onAddToCloset={() => addToCloset(current)}
                onScanAnother={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </main>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score > 70 ? "#8FBF8A" : score > 45 ? "#E8B86D" : "#D97757";
  return (
    <span
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
      style={{ backgroundColor: `${tone}22`, color: tone }}
    >
      {score}
    </span>
  );
}

function ProductResult({
  record,
  inCloset,
  onAddToCloset,
  onScanAnother,
}: {
  record: ScanRecord;
  inCloset: boolean;
  onAddToCloset: () => void;
  onScanAnother: () => void;
}) {
  const { t } = useTranslation();
  const { product, compatibility } = record;

  return (
    <div>
      <div className="glass mb-6 flex flex-col items-center rounded-4xl px-6 py-8 text-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="mb-4 h-28 w-28 rounded-2xl border border-line object-contain bg-hairline/5"
          />
        ) : (
          <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-2xl border border-line bg-hairline/5">
            <Sparkles size={28} className="text-copper-light" />
          </div>
        )}
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {product.source === "openbeautyfacts" ? t("scanner.openBeautyFacts") : t("scanner.demoDb")}
        </span>
        <h1 className="mt-1 font-display text-xl font-medium text-cream">{product.name}</h1>
        {product.brand && <p className="font-body text-sm text-muted">{product.brand}</p>}

        <div className="mt-6">
          <StrandGauge score={compatibility.score} size={170} strands={12} label={t("scanner.compatibility")} />
        </div>
        <p className="mt-3 font-body text-sm text-cream/80">{compatibility.verdict}</p>
        {!compatibility.personalized && (
          <p className="mt-2 max-w-xs font-body text-xs text-muted">
            {t("scanner.scoreCompositionOnly")}{" "}
            <Link href="/" className="text-copper-light underline underline-offset-2">
              {t("scanner.doDiagnostic")}
            </Link>{" "}
          </p>
        )}
        {compatibility.source === "ai" && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-copper-light/80">
            {t("scanner.aiAnalysis")}
          </p>
        )}
      </div>

      {compatibility.analysis && (
        <div className="glass mb-6 rounded-3xl p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {t("scanner.detailedAnalysis")}
          </span>
          <p className="mt-2 font-body text-sm leading-relaxed text-cream/85">{compatibility.analysis}</p>
        </div>
      )}

      {compatibility.positives.length > 0 && (
        <FactorList title={t("scanner.positives")} items={compatibility.positives} tone="positive" />
      )}
      {compatibility.negatives.length > 0 && (
        <FactorList title={t("scanner.watchOut")} items={compatibility.negatives} tone="negative" />
      )}

      {compatibility.usageTips && compatibility.usageTips.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg text-cream">{t("scanner.usageTips")}</h2>
          <div className="glass flex flex-col gap-2 rounded-3xl p-5">
            {compatibility.usageTips.map((tip) => (
              <p key={tip} className="font-body text-sm leading-relaxed text-cream/80">
                · {tip}
              </p>
            ))}
          </div>
        </div>
      )}

      {product.ingredientsText && (
        <div className="glass mb-6 rounded-3xl p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{t("scanner.composition")}</span>
          <p className="mt-2 font-body text-xs leading-relaxed text-cream/70">{product.ingredientsText}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={onAddToCloset}
          disabled={inCloset}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:opacity-60"
        >
          {inCloset ? <Check size={16} /> : <PackagePlus size={16} />}
          {inCloset ? t("scanner.inCloset") : t("scanner.addToCloset")}
        </button>
        <button
          onClick={onScanAnother}
          className="flex h-14 items-center justify-center gap-2 rounded-full border border-line font-body text-sm text-cream/80 transition hover:border-copper/50"
        >
          <RotateCcw size={16} />
          {t("scanner.scanAnother")}
        </button>
      </div>
    </div>
  );
}

function FactorList({
  title,
  items,
  tone,
}: {
  title: string;
  items: { label: string; detail: string }[];
  tone: "positive" | "negative";
}) {
  const color = tone === "positive" ? "#8FBF8A" : "#D97757";
  return (
    <div className="mb-6">
      <h2 className="mb-3 font-display text-lg text-cream">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="glass flex gap-3 rounded-2xl p-4">
            <span
              className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {tone === "positive" ? <Check size={12} /> : <AlertTriangle size={11} />}
            </span>
            <div>
              <p className="font-body text-sm text-cream">{item.label}</p>
              <p className="mt-0.5 font-body text-xs leading-relaxed text-muted">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
