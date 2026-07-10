import type { Product } from "./products";
import type { HairProfile } from "./mockAnalysis";
import type { Answers } from "./store";

export interface CompatibilityFactor {
  label: string;
  detail: string;
}

export interface CompatibilityResult {
  score: number;
  verdict: string;
  personalized: boolean;
  positives: CompatibilityFactor[];
  negatives: CompatibilityFactor[];
  /** Detailed AI analysis (why it fits or not). */
  analysis?: string;
  /** Practical usage tips for this profile. */
  usageTips?: string[];
  source?: "ai" | "rules";
}

interface Rule {
  label: string;
  matchers: string[];
  reasonGeneric: string;
  reasonBoost?: string;
  weight: number;
  sensitiveMetric?: keyof HairProfile["metrics"];
  relatedGoal?: string;
}

const NEGATIVE_RULES: Rule[] = [
  {
    label: "Sulfates",
    matchers: ["sodium laureth sulfate", "sodium lauryl sulfate", "ammonium lauryl sulfate"],
    reasonGeneric: "Tensioactif nettoyant puissant, peut assécher la fibre et le cuir chevelu.",
    reasonBoost: "Votre cuir chevelu / hydratation est déjà fragile : ces sulfates risquent d'accentuer la sécheresse.",
    weight: 10,
    sensitiveMetric: "hydration",
  },
  {
    label: "Silicones non hydrosolubles",
    matchers: ["dimethicone", "amodimethicone", "cyclopentasiloxane", "cyclomethicone"],
    reasonGeneric: "Peut créer un effet cumulatif et alourdir la fibre à la longue.",
    reasonBoost: "Avec une densité/volume déjà limités, l'effet alourdissant sera plus visible.",
    weight: 6,
    sensitiveMetric: "volume",
  },
  {
    label: "Alcool desséchant",
    matchers: ["alcohol denat", "sd alcohol", "isopropyl alcohol"],
    reasonGeneric: "Alcool volatil asséchant, à limiter sur cheveux poreux ou secs.",
    reasonBoost: "Votre porosité/hydratation actuelle rend cet ingrédient plus risqué pour vous.",
    weight: 12,
    sensitiveMetric: "hydration",
  },
  {
    label: "Parabènes",
    matchers: ["methylparaben", "propylparaben", "butylparaben"],
    reasonGeneric: "Conservateur parfois mal toléré par les cuirs chevelus sensibles.",
    reasonBoost: "Votre cuir chevelu est identifié comme sensible : à surveiller en priorité.",
    weight: 5,
    sensitiveMetric: "scalp",
  },
  {
    label: "Huiles minérales",
    matchers: ["mineral oil", "paraffinum liquidum", "petrolatum"],
    reasonGeneric: "Occlusif qui peut empêcher l'hydratation de pénétrer la fibre.",
    weight: 6,
    sensitiveMetric: "porosity",
  },
];

const POSITIVE_RULES: Rule[] = [
  {
    label: "Glycérine",
    matchers: ["glycerin"],
    reasonGeneric: "Humectant qui capte et retient l'eau dans la fibre.",
    weight: 6,
    relatedGoal: "hydratation",
  },
  {
    label: "Panthénol (pro-vitamine B5)",
    matchers: ["panthenol"],
    reasonGeneric: "Fortifie la fibre et améliore sa souplesse.",
    weight: 6,
    relatedGoal: "reparation",
  },
  {
    label: "Acide hyaluronique",
    matchers: ["hyaluronic acid", "sodium hyaluronate"],
    reasonGeneric: "Hydratation intense, retient l'eau en surface de la fibre.",
    weight: 7,
    relatedGoal: "hydratation",
  },
  {
    label: "Aloe vera",
    matchers: ["aloe barbadensis", "aloe vera"],
    reasonGeneric: "Apaisant et hydratant, bien toléré par les cuirs chevelus sensibles.",
    weight: 5,
    relatedGoal: "hydratation",
  },
  {
    label: "Beurre de karité",
    matchers: ["butyrospermum parkii", "shea butter"],
    reasonGeneric: "Nourrissant, aide à réduire la casse sur cheveux secs.",
    weight: 6,
    relatedGoal: "casse",
  },
  {
    label: "Huile de jojoba",
    matchers: ["simmondsia chinensis", "jojoba oil"],
    reasonGeneric: "Proche du sébum naturel, régule sans alourdir.",
    weight: 5,
    relatedGoal: "hydratation",
  },
  {
    label: "Huile d'argan",
    matchers: ["argania spinosa"],
    reasonGeneric: "Nourrit les longueurs sans effet gras prononcé.",
    weight: 5,
    relatedGoal: "reparation",
  },
  {
    label: "Kératine hydrolysée",
    matchers: ["hydrolyzed keratin"],
    reasonGeneric: "Renforce la fibre en comblant les zones abîmées.",
    weight: 7,
    relatedGoal: "casse",
  },
  {
    label: "Huile de ricin",
    matchers: ["ricinus communis"],
    reasonGeneric: "Populaire pour stimuler la sensation de pousse et fortifier les longueurs.",
    weight: 5,
    relatedGoal: "pousse",
  },
];

/** Rule-based compatibility (fallback when OpenAI is unavailable). */
export function computeCompatibilityRules(
  product: Product,
  profile: HairProfile | null,
  answers: Answers
): CompatibilityResult {
  const text = (product.ingredientsText || product.ingredients.join(", ")).toLowerCase();
  const goals = Array.isArray(answers.goals) ? (answers.goals as string[]) : [];

  let score = 68;
  const positives: CompatibilityFactor[] = [];
  const negatives: CompatibilityFactor[] = [];

  for (const rule of NEGATIVE_RULES) {
    if (!rule.matchers.some((m) => text.includes(m))) continue;
    let penalty = rule.weight;
    let detail = rule.reasonGeneric;
    if (profile && rule.sensitiveMetric && profile.metrics[rule.sensitiveMetric] < 45 && rule.reasonBoost) {
      penalty += 6;
      detail = rule.reasonBoost;
    }
    score -= penalty;
    negatives.push({ label: rule.label, detail });
  }

  for (const rule of POSITIVE_RULES) {
    if (!rule.matchers.some((m) => text.includes(m))) continue;
    let bonus = rule.weight;
    if (rule.relatedGoal && goals.includes(rule.relatedGoal)) bonus += 4;
    score += bonus;
    positives.push({ label: rule.label, detail: rule.reasonGeneric });
  }

  score = Math.max(4, Math.min(97, Math.round(score)));

  const verdict =
    score >= 75
      ? "Bonne compatibilité avec votre profil"
      : score >= 50
        ? "Compatibilité correcte, quelques réserves"
        : "Compatibilité faible pour votre profil";

  return {
    score,
    verdict,
    personalized: Boolean(profile),
    positives,
    negatives,
    source: "rules",
  };
}

/** @deprecated Use analyzeProductWithAI — kept for sync callers (e.g. report catalog). */
export function computeCompatibility(
  product: Product,
  profile: HairProfile | null,
  answers: Answers
): CompatibilityResult {
  return computeCompatibilityRules(product, profile, answers);
}

export type UserProfileInput = HairProfile | null;

/**
 * AI-powered product compatibility analysis personalized to the user's hair profile.
 * Falls back to rule-based scoring if OpenAI is unavailable or errors.
 */
export async function analyzeProductWithAI(
  product: Product,
  userProfile: UserProfileInput,
  answers: Answers,
  locale: "en" | "fr" = "fr"
): Promise<CompatibilityResult> {
  try {
    const res = await fetch("/api/analyze-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, profile: userProfile, answers, locale }),
    });

    if (res.ok) {
      return (await res.json()) as CompatibilityResult;
    }

    if (res.status !== 501) {
      console.warn("[analyzeProductWithAI] API error", res.status);
    }
  } catch (error) {
    console.warn("[analyzeProductWithAI] fetch failed", error);
  }

  return computeCompatibilityRules(product, userProfile, answers);
}
