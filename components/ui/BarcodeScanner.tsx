"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type ScannerStatus = "idle" | "requesting" | "scanning" | "denied" | "unsupported";

export function BarcodeScanner({
  active,
  onDetected,
}: {
  active: boolean;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");

  useEffect(() => {
    if (!active) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;
    setStatus("requesting");

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls;
        if (cancelled) return;
        setStatus((s) => (s === "requesting" ? "scanning" : s));
        if (result) {
          const text = result.getText();
          controls.stop();
          onDetected(text);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-surface">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

      {status !== "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80 px-8 text-center">
          <p className="font-body text-sm text-cream/80">
            {status === "denied" &&
              "Caméra indisponible ou permission refusée — utilisez la saisie manuelle ci-dessous."}
            {status === "unsupported" &&
              "L'accès caméra n'est pas possible ici — utilisez la saisie manuelle ci-dessous."}
            {(status === "idle" || status === "requesting") && "Activation de la caméra…"}
          </p>
        </div>
      )}

      {status === "scanning" && (
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-copper/70">
          <Corner className="-left-0.5 -top-0.5 rotate-0" />
          <Corner className="-right-0.5 -top-0.5 rotate-90" />
          <Corner className="-bottom-0.5 -left-0.5 -rotate-90" />
          <Corner className="-bottom-0.5 -right-0.5 rotate-180" />
          <motion.div
            className="absolute left-0 right-0 h-0.5 rounded-full bg-copper-gradient shadow-glow"
            animate={{ top: ["6%", "94%", "6%"] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className={`absolute ${className}`}>
      <path d="M1 9V3a2 2 0 0 1 2-2h6" fill="none" stroke="#E8B86D" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
