"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2, ScanLine, Sparkles } from "lucide-react";
import { useScannerStore } from "@/lib/scannerStore";
import { localizeProduct } from "@/lib/products";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

export default function PlacardPage() {
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { closet, removeFromCloset } = useScannerStore();

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("placard.title")}</span>
        </div>

        {closet.length === 0 ? (
          <div className="glass flex flex-col items-center rounded-4xl px-6 py-14 text-center">
            <Sparkles size={24} className="mb-4 text-copper-light" />
            <p className="mb-6 max-w-xs font-body text-sm text-muted">{t("placard.empty")}</p>
            <Link
              href="/scanner"
              className="flex h-12 items-center gap-2 rounded-full bg-copper-gradient px-6 font-body text-sm font-semibold text-ink shadow-glow"
            >
              <ScanLine size={16} />
              {t("placard.scanProduct")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {closet.map((r, i) => {
              const product = localizeProduct(r.product, locale);
              return (
              <motion.div
                key={r.product.barcode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass flex items-center gap-4 rounded-3xl p-4"
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-14 w-14 flex-shrink-0 rounded-xl border border-line bg-hairline/5 object-contain"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-hairline/5">
                    <Sparkles size={18} className="text-copper-light" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm text-cream">{product.name}</p>
                  <p className="truncate font-body text-xs text-muted">{product.brand || product.category}</p>
                </div>
                <ScoreBadge score={r.compatibility.score} />
                <button
                  onClick={() => removeFromCloset(r.product.barcode)}
                  aria-label={t("placard.remove")}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:text-copper-light"
                >
                  <Trash2 size={15} />
                </button>
              </motion.div>
            );})}

            <Link
              href="/scanner"
              className="mt-3 flex h-14 items-center justify-center gap-2 rounded-full border border-line font-body text-sm text-cream/80 transition hover:border-copper/50"
            >
              <ScanLine size={16} />
              {t("placard.scanAnother")}
            </Link>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score > 70 ? "#8FBF8A" : score > 45 ? "#E8B86D" : "#D97757";
  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold"
      style={{ backgroundColor: `${tone}22`, color: tone }}
    >
      {score}
    </span>
  );
}
