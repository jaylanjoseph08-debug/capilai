/**
 * Helper functions to build a HairProfile from AI analysis results.
 */

import type { Answers } from "./store";
import type { Locale } from "./locale";
import type { HairProfile } from "./mockAnalysis";

type Level = HairProfile["breakageLevel"];

const copy = {
  en: {
    strengths: {
      elasticity: "Good elasticity",
      density: "Dense hair",
      hydration: "Well-hydrated hair",
      scalp: "Healthy scalp",
      none: "No major issues detected",
    },
    causes: {
      hydration: "Lack of deep hydration",
      scalp: "Scalp imbalance possibly linked to stress",
      density: "Fragile hair fiber",
      porosity: "High porosity — needs smoothing care",
      default: "Genetic and environmental factors",
    },
    advice: {
      hydration: "Add a hydrating mask 1–2 times per week",
      scalp: "Massage your scalp regularly to boost circulation",
      elasticity: "Use heat protectant products",
      porosity: "Prefer smoothing products and lightweight oils",
      default: "Maintain a regular routine suited to your hair",
    },
    hairType: {
      porous: "Porous",
      resistant: "Resistant",
      thick: "Thick",
      fine: "Fine",
      normal: "Normal",
    },
    routine: {
      morning: ["Apply a light leave-in conditioner", "Style without stressing the fiber"],
      evening: ["Detangle gently before bed", "Use a microfiber towel"],
      washDay: [
        "Gentle shampoo (sulfate-free recommended)",
        "Rinse with cool water to seal the cuticle",
        "Hydrating or smoothing mask as needed",
      ],
      masksLow: ["Hydrating mask 1–2×/week", "Key ingredients: glycerin, hyaluronic acid"],
      masksOk: ["Maintenance mask every 2 weeks"],
      oilsHigh: ["Light oil (jojoba, hazelnut)", "As a pre-shampoo treatment"],
      oilsLow: ["Rich oil (argan, coconut) occasionally"],
      freqDaily: "Daily (cool water preferred)",
      freqRegular: "2–3 times per week",
    },
  },
  fr: {
    strengths: {
      elasticity: "Bonne élasticité",
      density: "Cheveux denses",
      hydration: "Cheveux bien hydratés",
      scalp: "Cuir chevelu sain",
      none: "Pas de problème majeur détecté",
    },
    causes: {
      hydration: "Manque d'hydratation profonde",
      scalp: "Déséquilibre du cuir chevelu possiblement lié au stress",
      density: "Fragilité de la fibre capillaire",
      porosity: "Porosité élevée, besoin de soins gainants",
      default: "Facteurs génétiques et environnementaux",
    },
    advice: {
      hydration: "Intégrez un masque hydratant 1-2 fois par semaine",
      scalp: "Massez le cuir chevelu régulièrement pour stimuler la circulation",
      elasticity: "Utilisez des produits protecteurs contre la chaleur",
      porosity: "Privilégiez les produits gainants et les huiles légères",
      default: "Maintenez une routine régulière adaptée à vos cheveux",
    },
    hairType: {
      porous: "Poreux",
      resistant: "Résistant",
      thick: "Épais",
      fine: "Fins",
      normal: "Normal",
    },
    routine: {
      morning: ["Appliquez un leave-in conditioner léger", "Coiffez sans agresser la fibre"],
      evening: ["Démêlez délicatement avant de dormir", "Utilisez une serviette microfibre"],
      washDay: [
        "Shampoing doux (sans sulfates recommandé)",
        "Rinçage à l'eau froide pour sceller la cuticule",
        "Masque hydratant ou gainant selon vos besoins",
      ],
      masksLow: ["Masque hydratant 1-2x/semaine", "Ingrédients clés : glycérine, acide hyaluronique"],
      masksOk: ["Masque entretien 1x/2 semaines"],
      oilsHigh: ["Huile légère (jojoba, noisette)", "En masque pré-shampoing"],
      oilsLow: ["Huile riche (argan, coco) occasionnellement"],
      freqDaily: "Quotidien (eau froide préférable)",
      freqRegular: "2-3 fois par semaine",
    },
  },
} as const;

function L(locale: Locale) {
  return copy[locale];
}

export function buildHairProfileFromAI(
  aiData: {
    score: number;
    metrics: Record<string, number>;
    detectedIssues: string[];
    priorities: string[];
    summary: string;
  },
  answers: Answers,
  locale: Locale = "en"
): HairProfile {
  const report = {
    summary: aiData.summary,
    strengths: generateStrengths(aiData.metrics, locale),
    weaknesses: aiData.detectedIssues,
    probableCauses: generateCauses(aiData.metrics, answers, locale),
    advice: generateAdviceFromMetrics(aiData.metrics, answers, locale),
  };

  return {
    generatedAt: new Date().toISOString(),
    locale,
    score: aiData.score,
    metrics: {
      health: aiData.metrics.health || 70,
      hydration: aiData.metrics.hydration || 65,
      density: aiData.metrics.density || 70,
      porosity: aiData.metrics.porosity || 60,
      volume: aiData.metrics.volume || 65,
      thickness: aiData.metrics.thickness || 70,
      elasticity: aiData.metrics.elasticity || 75,
      scalp: aiData.metrics.scalp || 70,
    },
    hairType: inferHairType(aiData.metrics, answers, locale),
    breakageLevel: inferBreakageLevel(aiData.metrics),
    frizz: inferFrizz(aiData.metrics),
    curlDefinition: inferCurlDefinition(answers),
    priorities: aiData.priorities.slice(0, 3),
    report,
    routine: generateRoutine(aiData.metrics, answers, locale),
  };
}

export function generateStrengths(metrics: Record<string, number>, locale: Locale): string[] {
  const t = L(locale);
  const strengths: string[] = [];
  if (metrics.elasticity > 70) strengths.push(t.strengths.elasticity);
  if (metrics.density > 70) strengths.push(t.strengths.density);
  if (metrics.hydration > 70) strengths.push(t.strengths.hydration);
  if (metrics.scalp > 70) strengths.push(t.strengths.scalp);
  return strengths.length > 0 ? strengths : [t.strengths.none];
}

export function generateCauses(metrics: Record<string, number>, answers: Answers, locale: Locale): string[] {
  const t = L(locale);
  const causes: string[] = [];
  if (metrics.hydration < 50) causes.push(t.causes.hydration);
  if (metrics.scalp < 50) causes.push(t.causes.scalp);
  if (metrics.density < 50) causes.push(t.causes.density);
  if (metrics.porosity > 70) causes.push(t.causes.porosity);
  return causes.length > 0 ? causes : [t.causes.default];
}

export function generateAdviceFromMetrics(
  metrics: Record<string, number>,
  answers: Answers,
  locale: Locale
): string[] {
  const t = L(locale);
  const advice: string[] = [];
  if (metrics.hydration < 60) advice.push(t.advice.hydration);
  if (metrics.scalp < 60) advice.push(t.advice.scalp);
  if (metrics.elasticity < 60) advice.push(t.advice.elasticity);
  if (metrics.porosity > 70) advice.push(t.advice.porosity);
  if (advice.length < 3) advice.push(t.advice.default);
  return advice.slice(0, 4);
}

export function inferHairType(metrics: Record<string, number>, answers: Answers, locale: Locale): string {
  const t = L(locale).hairType;
  if (metrics.porosity > 70) return t.porous;
  if (metrics.porosity < 40) return t.resistant;
  if (metrics.density > 70) return t.thick;
  if (metrics.density < 40) return t.fine;
  return t.normal;
}

export function inferBreakageLevel(metrics: Record<string, number>): Level {
  if (metrics.elasticity > 70) return "faible";
  if (metrics.elasticity > 50) return "modéré";
  return "élevé";
}

export function inferFrizz(metrics: Record<string, number>): Level {
  if (metrics.hydration > 70) return "faible";
  if (metrics.hydration > 50) return "modéré";
  return "élevé";
}

export function inferCurlDefinition(answers: Answers): HairProfile["curlDefinition"] {
  return "moyenne";
}

export function generateRoutine(metrics: Record<string, number>, answers: Answers, locale: Locale) {
  const t = L(locale).routine;
  return {
    morning: [...t.morning],
    evening: [...t.evening],
    washDay: [...t.washDay],
    masks: metrics.hydration < 60 ? [...t.masksLow] : [...t.masksOk],
    oils: metrics.porosity > 70 ? [...t.oilsHigh] : [...t.oilsLow],
    frequency: answers.washFrequency === "quotidien" ? t.freqDaily : t.freqRegular,
  };
}
