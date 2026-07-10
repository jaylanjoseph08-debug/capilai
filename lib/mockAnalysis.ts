import type { Answers } from "./store";
import type { Locale } from "./locale";
import { getPipelineSteps } from "./i18n";
import { buildHairProfileFromAI } from "./hairAnalysisHelpers";
import { getAnalyzeHairUrl } from "./appConfig";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * ANALYSIS ENGINE — ARCHITECTURE NOTE
 * ─────────────────────────────────────────────────────────────────────────
 * This module simulates the 11-stage AI pipeline described in the product
 * brief. Every function below is written so a real implementation can be
 * dropped in without touching any UI code:
 *
 *   extractFrames()      -> replace with ffmpeg/wasm or a server route that
 *                            receives the recorded video and returns frames
 *   detectHair()          -> replace with a segmentation model (e.g. a
 *                            fine-tuned SAM / Mediapipe Hair Segmenter)
 *   detectScalp()          -> same, scalp-focused segmentation
 *   analyzeTexture()       -> vision model / classifier (curl pattern,
 *                            strand thickness) — could call OpenAI/Gemini
 *                            vision or a custom CV model via an API route
 *   analyzeDensity()       -> CV heuristic or model output
 *   analyzeVolume()        -> CV heuristic or model output
 *   analyzePorosity()      -> estimated from texture + questionnaire
 *   analyzeCurlPattern()   -> model output
 *   analyzeOverallHealth() -> fusion step
 *   mergeWithQuestionnaire() -> combines steps 1-9 with onboarding answers
 *   buildHairProfile()     -> final Hair Profile object, the only artifact
 *                            the rest of the app consumes
 *
 * In production, `runAnalysisPipeline` should become a server action that
 * uploads the captured video to storage (Supabase Storage), calls the
 * vision pipeline, and persists the resulting HairProfile + Report rows.
 * The UI (analyzing/page.tsx, dashboard/page.tsx) never needs to change.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface HairProfile {
  generatedAt: string;
  locale?: Locale;
  score: number;
  metrics: {
    health: number;
    hydration: number;
    density: number;
    porosity: number;
    volume: number;
    thickness: number;
    elasticity: number;
    scalp: number;
  };
  hairType: string;
  breakageLevel: "faible" | "modéré" | "élevé";
  frizz: "faible" | "modéré" | "élevé";
  curlDefinition: "faible" | "moyenne" | "forte";
  priorities: string[];
  report: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    probableCauses: string[];
    advice: string[];
  };
  routine: {
    morning: string[];
    evening: string[];
    washDay: string[];
    masks: string[];
    oils: string[];
    frequency: string;
  };
}

export type AnalysisSource = "ai" | "mock" | "mock-fallback";

export const pipelineSteps = getPipelineSteps("en");

export type AnalysisProgress =
  | { stage: "frames"; current: number; total: number }
  | { stage: "pipeline"; index: number; label: string };

export type AnalysisPipelineResult = {
  profile: HairProfile;
  source: AnalysisSource;
};

// Simple deterministic hash so the same answers always produce the same
// profile (stands in for model inference during local development).
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededScore(seed: number, offset: number, base = 55, spread = 40) {
  const n = Math.sin(seed + offset) * 10000;
  const frac = n - Math.floor(n);
  return Math.round(base + frac * spread);
}

const goalLabels: Record<Locale, Record<string, string>> = {
  en: {
    pousse: "Boost growth",
    casse: "Reduce breakage",
    volume: "More volume",
    hydratation: "Deep hydration",
    reparation: "Repair fiber",
    definition_boucles: "Define curls",
    frisottis: "Reduce frizz",
    pellicules: "Reduce dandruff",
  },
  fr: {
    pousse: "Favoriser la pousse",
    casse: "Réduire la casse",
    volume: "Plus de volume",
    hydratation: "Hydrater en profondeur",
    reparation: "Réparer la fibre",
    definition_boucles: "Définir les boucles",
    frisottis: "Réduire les frisottis",
    pellicules: "Diminuer les pellicules",
  },
};

async function analyzeWithAI(
  videoBlob: Blob,
  locale: Locale,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<Partial<HairProfile>> {
  const { extractFramesFromVideo } = await import("./videoProcessor");
  const { fetchWithRetry } = await import("./fetchWithRetry");

  const frames = await extractFramesFromVideo(videoBlob, {
    onProgress: (p) => {
      if (p.phase === "extracting" || p.phase === "loading") {
        onProgress?.({ stage: "frames", current: p.current, total: p.total });
      }
    },
  });

  if (frames.length === 0) {
    throw new Error("No frames extracted from video");
  }

  const response = await fetchWithRetry(
    getAnalyzeHairUrl(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames, locale }),
    },
    { retries: 2, timeoutMs: 55_000, backoffMs: 1000 }
  );

  const result = (await response.json()) as {
    configured?: boolean;
    error?: string;
    code?: string;
    score?: number;
  };

  if (!response.ok) {
    throw new Error(result.error ?? `Analysis failed (${response.status})`);
  }

  if (!result.configured) {
    throw new Error(result.error ?? "AI not configured");
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return result as Partial<HairProfile>;
}

export async function runAnalysisPipeline(
  answers: Answers,
  onStep?: (index: number, label: string) => void,
  videoBlob?: Blob,
  locale: Locale = "en",
  onProgress?: (progress: AnalysisProgress) => void
): Promise<AnalysisPipelineResult> {
  const steps = getPipelineSteps(locale);
  let aiAnalysis: Partial<HairProfile> | null = null;
  let source: AnalysisSource = "mock";

  if (videoBlob) {
    try {
      onStep?.(0, steps[0]);
      onProgress?.({ stage: "pipeline", index: 0, label: steps[0] });
      aiAnalysis = await analyzeWithAI(videoBlob, locale, onProgress);
      source = "ai";
    } catch (error) {
      console.warn("AI analysis failed, falling back to mock:", error);
      source = "mock-fallback";
    }
  }

  if (!aiAnalysis) {
    for (let i = 0; i < steps.length; i++) {
      onStep?.(i, steps[i]);
      onProgress?.({ stage: "pipeline", index: i, label: steps[i] });
      await new Promise((r) => setTimeout(r, 380));
    }
  } else {
    for (let i = 1; i < steps.length; i++) {
      onStep?.(i, steps[i]);
      onProgress?.({ stage: "pipeline", index: i, label: steps[i] });
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const profile =
    aiAnalysis && "score" in aiAnalysis
      ? buildHairProfileFromAI(
          aiAnalysis as unknown as Parameters<typeof buildHairProfileFromAI>[0],
          answers,
          locale
        )
      : buildHairProfile(answers, locale);

  return { profile, source };
}

export function buildHairProfile(answers: Answers, locale: Locale = "en"): HairProfile {
  const seed = hashSeed(JSON.stringify(answers)) % 1000;
  const isFr = locale === "fr";

  const scalp = Array.isArray(answers.scalpBehavior) ? answers.scalpBehavior : [];
  const treatments = Array.isArray(answers.recentTreatments) ? answers.recentTreatments : [];
  const goals = Array.isArray(answers.goals) ? answers.goals : [];

  const dryPenalty = scalp.includes("tres_sec") ? -12 : scalp.includes("sec") ? -6 : 0;
  const damagePenalty =
    treatments.includes("decoloration") ? -15 : treatments.includes("lissage") ? -8 : treatments.includes("coloration") ? -4 : 0;

  const metrics = {
    health: clamp(seededScore(seed, 1) + damagePenalty),
    hydration: clamp(seededScore(seed, 2) + dryPenalty),
    density: clamp(seededScore(seed, 3)),
    porosity: clamp(seededScore(seed, 4) + damagePenalty / 2),
    volume: clamp(seededScore(seed, 5)),
    thickness: clamp(seededScore(seed, 6)),
    elasticity: clamp(seededScore(seed, 7) + damagePenalty / 2),
    scalp: clamp(seededScore(seed, 8) + dryPenalty),
  };

  const score = Math.round(
    Object.values(metrics).reduce((a, b) => a + b, 0) / Object.values(metrics).length
  );

  const breakageLevel = metrics.elasticity < 45 ? "élevé" : metrics.elasticity < 65 ? "modéré" : "faible";
  const frizz = metrics.hydration < 45 ? "élevé" : metrics.hydration < 65 ? "modéré" : "faible";
  const curlDefinition = metrics.hydration > 65 ? "forte" : metrics.hydration > 45 ? "moyenne" : "faible";

  const sortedMetrics = Object.entries(metrics).sort((a, b) => a[1] - b[1]);
  const weakestKeys = sortedMetrics.slice(0, 3).map(([k]) => k);
  const strongestKeys = sortedMetrics.slice(-2).map(([k]) => k);

  const labels: Record<string, string> = isFr
    ? {
        health: "santé générale",
        hydration: "hydratation",
        density: "densité",
        porosity: "porosité",
        volume: "volume",
        thickness: "épaisseur",
        elasticity: "élasticité",
        scalp: "cuir chevelu",
      }
    : {
        health: "overall health",
        hydration: "hydration",
        density: "density",
        porosity: "porosity",
        volume: "volume",
        thickness: "thickness",
        elasticity: "elasticity",
        scalp: "scalp",
      };

  const goalsMap = goalLabels[locale];
  const priorities = (goals.length ? goals : weakestKeys)
    .slice(0, 4)
    .map((g) => goalsMap[g] ?? (isFr ? `Améliorer ${labels[g] ?? g}` : `Improve ${labels[g] ?? g}`));

  const healthDesc =
    score > 70
      ? isFr
        ? "globalement en bonne santé"
        : "generally healthy"
      : score > 50
        ? isFr
          ? "correcte mais perfectible"
          : "fair but could improve"
        : isFr
          ? "fragilisée et a besoin d'attention"
          : "fragile and needs attention";

  return {
    generatedAt: new Date().toISOString(),
    locale,
    score,
    metrics,
    hairType: String(answers.hairType ?? (isFr ? "non renseigné" : "not specified")),
    breakageLevel,
    frizz,
    curlDefinition,
    priorities,
    report: {
      summary: isFr
        ? `Votre profil capillaire affiche un score global de ${score}/100. La fibre est ${healthDesc}, avec des marges de progression sur ${labels[weakestKeys[0]]} et ${labels[weakestKeys[1]]}.`
        : `Your hair profile shows an overall score of ${score}/100. Your hair is ${healthDesc}, with room to improve ${labels[weakestKeys[0]]} and ${labels[weakestKeys[1]]}.`,
      strengths: strongestKeys.map((k) =>
        isFr
          ? `${cap(labels[k])} au-dessus de la moyenne (${metrics[k as keyof typeof metrics]}/100)`
          : `${cap(labels[k])} above average (${metrics[k as keyof typeof metrics]}/100)`
      ),
      weaknesses: weakestKeys.map((k) =>
        isFr
          ? `${cap(labels[k])} à surveiller (${metrics[k as keyof typeof metrics]}/100)`
          : `${cap(labels[k])} needs attention (${metrics[k as keyof typeof metrics]}/100)`
      ),
      probableCauses: [
        ...(damagePenalty < 0
          ? [
              isFr
                ? "Traitements chimiques récents (coloration, décoloration ou lissage)"
                : "Recent chemical treatments (color, bleach, or straightening)",
            ]
          : []),
        ...(dryPenalty < 0
          ? [isFr ? "Cuir chevelu asséché entre les lavages" : "Dry scalp between washes"]
          : []),
        isFr
          ? "Routine actuelle pas encore alignée avec vos objectifs prioritaires"
          : "Current routine not yet aligned with your top goals",
      ],
      advice: isFr
        ? [
            "Espacez les sources de chaleur et privilégiez un séchage à l'air libre",
            "Intégrez un soin hydratant profond une fois par semaine",
            "Adoptez une routine adaptée à votre type de cheveux plutôt qu'une routine générique",
          ]
        : [
            "Reduce heat styling and air-dry when possible",
            "Add a deep hydrating treatment once a week",
            "Follow a routine tailored to your hair type rather than a generic one",
          ],
    },
    routine: isFr
      ? {
          morning: ["Brumisation hydratante", "Crème coiffante légère sans rinçage", "Protection anti-frisottis si besoin"],
          evening: ["Brossage doux avant coucher", "Bonnet ou taie en satin pour limiter la casse"],
          washDay: [
            "Pré-shampoing à l'huile 20 minutes avant le lavage",
            "Shampoing doux sans sulfates",
            "Après-shampoing démêlant du milieu aux pointes",
          ],
          masks: ["Masque hydratant profond 1x/semaine", "Masque protéiné léger toutes les 3 semaines"],
          oils: ["Huile de jojoba en soin des longueurs", "Huile de ricin en massage du cuir chevelu"],
          frequency: String(answers.washFrequency ?? "à définir"),
        }
      : {
          morning: ["Hydrating mist", "Light leave-in styling cream", "Anti-frizz protection if needed"],
          evening: ["Gentle brushing before bed", "Satin bonnet or pillowcase to reduce breakage"],
          washDay: [
            "Pre-shampoo oil treatment 20 minutes before washing",
            "Gentle sulfate-free shampoo",
            "Detangling conditioner mid-lengths to ends",
          ],
          masks: ["Deep hydrating mask 1x/week", "Light protein mask every 3 weeks"],
          oils: ["Jojoba oil on lengths", "Castor oil scalp massage"],
          frequency: String(answers.washFrequency ?? "to be defined"),
        },
  };
}

function clamp(n: number, min = 5, max = 98) {
  return Math.max(min, Math.min(max, n));
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
