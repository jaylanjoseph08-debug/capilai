"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, AlertTriangle } from "lucide-react";
import { useSelectedPlan } from "@/lib/subscriptionStore";
import { canStartHairScan, pricingUrlForScanLimit } from "@/lib/hairScanQuota";
import { useTranslation } from "@/lib/useTranslation";
import { saveCapturedVideo } from "@/lib/videoStorage";

export default function ScanPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const plan = useSelectedPlan();
  const guidance = [
    { text: t("scan.guidance0"), rotate: -22 },
    { text: t("scan.guidance1"), rotate: 0, tilt: -14 },
    { text: t("scan.guidance2"), rotate: 22 },
    { text: t("scan.guidance3"), rotate: 180 },
  ];
  const [phase, setPhase] = useState<"intro" | "recording" | "done" | "error">("intro");
  const [guideIndex, setGuideIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!canStartHairScan(plan)) {
      router.replace(pricingUrlForScanLimit(plan));
    }
  }, [plan, router]);

  useEffect(() => {
    if (phase !== "recording") return;
    if (guideIndex >= guidance.length - 1) {
      const timer = setTimeout(async () => {
        setPhase("done");
        setSaving(true);
        try {
          await finalizeRecording();
          setTimeout(() => router.push("/analyzing"), 400);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : t("scan.saveError"));
          setPhase("error");
        } finally {
          setSaving(false);
        }
      }, 1600);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setGuideIndex((i) => i + 1), 2200);
    return () => clearTimeout(timer);
  }, [phase, guideIndex, router, guidance.length, t]);

  async function startRecording() {
    setErrorMsg("");
    setPhase("recording");
    setGuideIndex(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
    } catch {
      setErrorMsg(t("scan.cameraError"));
      setPhase("error");
    }
  }

  function stopStream() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function finalizeRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        stopStream();
        return reject(new Error(t("scan.noRecording")));
      }

      recorder.onstop = async () => {
        stopStream();
        if (chunksRef.current.length === 0) {
          reject(new Error(t("scan.noRecording")));
          return;
        }
        try {
          const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
          await saveCapturedVideo(videoBlob);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      recorder.stop();
    });
  }

  useEffect(() => () => stopStream(), []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-ink px-6 py-10">
      <div className="w-full max-w-md text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{t("scan.label")}</span>
        <h1 className="mt-2 font-display text-2xl font-medium text-cream">{t("scan.title")}</h1>
      </div>

      <div className="relative flex h-80 w-80 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-line" />
        <div className="absolute inset-4 overflow-hidden rounded-full bg-surface">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full scale-x-[-1] object-cover opacity-70"
          />
        </div>
        <motion.div
          animate={{
            rotate: phase === "recording" ? guidance[guideIndex].rotate : 0,
          }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          className="pointer-events-none absolute"
        >
          <HeadSilhouette />
        </motion.div>
        {phase === "recording" && (
          <motion.div
            className="absolute inset-4 rounded-full border-2 border-copper"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
      </div>

      <div className="flex w-full max-w-md flex-col items-center">
        {phase === "error" && errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-copper/30 bg-copper/10 p-4">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-copper-light" />
            <p className="font-body text-xs text-cream/80">{errorMsg}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.p
            key={phase === "recording" ? guideIndex : phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 min-h-[2.5rem] text-center font-body text-sm text-cream/80"
          >
            {phase === "intro" && t("scan.introHint")}
            {phase === "recording" && guidance[guideIndex].text}
            {(phase === "done" || saving) && t("scan.doneHint")}
            {phase === "error" && t("scan.retryHint")}
          </motion.p>
        </AnimatePresence>

        {phase === "intro" && (
          <button
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-copper-gradient text-ink shadow-glow transition active:scale-95"
            aria-label={t("scan.startCapture")}
          >
            <Camera size={24} />
          </button>
        )}

        {phase === "recording" && (
          <div className="flex gap-2">
            {guidance.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition ${i <= guideIndex ? "bg-copper" : "bg-hairline/10"}`}
              />
            ))}
          </div>
        )}

        {phase === "error" && (
          <button
            onClick={() => {
              setErrorMsg("");
              setPhase("intro");
            }}
            className="flex h-12 items-center justify-center rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink"
          >
            {t("scan.retry")}
          </button>
        )}
      </div>
    </main>
  );
}

function HeadSilhouette() {
  return (
    <svg width="140" height="160" viewBox="0 0 140 160" fill="none">
      <ellipse cx="70" cy="70" rx="46" ry="54" fill="rgb(var(--text) / 0.14)" />
      <path
        d="M24 70C24 40 44 16 70 16C96 16 116 40 116 70C116 78 114 84 111 90C104 78 90 70 70 70C50 70 36 78 29 90C26 84 24 78 24 70Z"
        fill="rgba(201,124,75,0.35)"
      />
      <rect x="52" y="118" width="36" height="34" rx="14" fill="rgb(var(--text) / 0.12)" />
    </svg>
  );
}
