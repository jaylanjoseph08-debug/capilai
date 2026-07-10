import OpenAI from "openai";
import type { Product } from "./products";
import type { HairProfile } from "./mockAnalysis";
import type { Answers } from "./store";
import type { CompatibilityResult } from "./compatibility";
import { computeCompatibilityRules } from "./compatibility";

const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";
const TIMEOUT_MS = 45_000;

type AiProductPayload = {
  name: string;
  brand?: string;
  ingredientsText: string;
  ingredients: string[];
};

type AiProfilePayload = {
  score: number;
  metrics: HairProfile["metrics"];
  hairType: string;
  breakageLevel: string;
  frizz: string;
  curlDefinition: string;
  priorities: string[];
  weaknesses: string[];
};

function clampScore(n: unknown): number {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function buildProfilePayload(profile: HairProfile): AiProfilePayload {
  return {
    score: profile.score,
    metrics: profile.metrics,
    hairType: profile.hairType,
    breakageLevel: profile.breakageLevel,
    frizz: profile.frizz,
    curlDefinition: profile.curlDefinition,
    priorities: profile.priorities,
    weaknesses: profile.report?.weaknesses ?? [],
  };
}

function buildPrompt(
  product: AiProductPayload,
  profile: AiProfilePayload | null,
  goals: string[],
  locale: "en" | "fr"
): string {
  const lang = locale === "fr" ? "French" : "English";

  return `You are an expert trichologist and cosmetic chemist. Analyze hair product compatibility for a specific user profile.

Respond in ${lang} with valid JSON only using this exact structure:
{
  "score": <integer 0-100>,
  "verdict": "<short one-line compatibility verdict>",
  "analysis": "<2-4 sentences: why this product suits or does not suit this hair profile, based on INCI ingredients>",
  "benefits": [{"label": "<ingredient or benefit>", "detail": "<why it helps this profile>"}],
  "concerns": [{"label": "<ingredient or concern>", "detail": "<potential risk for this profile>"}],
  "usageTips": ["<how to use optimally for this profile>", "..."]
}

Requirements:
- Score must reflect real ingredient–profile interaction (hydration, density, porosity, volume, thickness, elasticity, scalp, health).
- Explain WHY the product fits or not for THIS profile, not generic advice.
- List 2-5 benefits and 0-4 concerns when relevant.
- usageTips: 2-4 practical tips (frequency, pairing, application).
- If no user profile, score from ingredient quality only (neutral baseline ~55-70).

PRODUCT:
Name: ${product.name}
Brand: ${product.brand ?? "Unknown"}
INCI: ${product.ingredientsText || product.ingredients.join(", ")}

USER HAIR PROFILE:
${profile ? JSON.stringify({ ...profile, goals }, null, 2) : "No profile — composition-only analysis."}`;
}

function parseAiResponse(raw: string): Omit<CompatibilityResult, "personalized" | "source"> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const benefits = Array.isArray(parsed.benefits)
      ? parsed.benefits
          .filter((b): b is { label: string; detail: string } =>
            Boolean(b && typeof b === "object" && typeof (b as { label?: string }).label === "string")
          )
          .slice(0, 6)
      : [];
    const concerns = Array.isArray(parsed.concerns)
      ? parsed.concerns
          .filter((c): c is { label: string; detail: string } =>
            Boolean(c && typeof c === "object" && typeof (c as { label?: string }).label === "string")
          )
          .slice(0, 6)
      : [];
    const usageTips = Array.isArray(parsed.usageTips)
      ? parsed.usageTips.filter((t): t is string => typeof t === "string").slice(0, 5)
      : [];

    return {
      score: clampScore(parsed.score),
      verdict: typeof parsed.verdict === "string" ? parsed.verdict : "",
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : "",
      positives: benefits.map((b) => ({ label: b.label, detail: b.detail || "" })),
      negatives: concerns.map((c) => ({ label: c.label, detail: c.detail || "" })),
      usageTips,
    };
  } catch {
    return null;
  }
}

export async function runProductCompatibilityAI(
  product: Product,
  profile: HairProfile | null,
  answers: Answers,
  locale: "en" | "fr" = "fr"
): Promise<CompatibilityResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ...computeCompatibilityRules(product, profile, answers), source: "rules" };
  }

  const goals = Array.isArray(answers.goals) ? (answers.goals as string[]) : [];
  const productPayload: AiProductPayload = {
    name: product.name,
    brand: product.brand,
    ingredientsText: product.ingredientsText,
    ingredients: product.ingredients,
  };
  const profilePayload = profile ? buildProfilePayload(profile) : null;

  try {
    const openai = new OpenAI({ apiKey });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await openai.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You analyze cosmetic INCI lists for personalized hair care compatibility. Return only valid JSON.",
          },
          {
            role: "user",
            content: buildPrompt(productPayload, profilePayload, goals, locale),
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");

    const parsed = parseAiResponse(content);
    if (!parsed) throw new Error("Could not parse AI JSON");

    return {
      ...parsed,
      verdict:
        parsed.verdict ||
        (parsed.score >= 75
          ? locale === "fr"
            ? "Bonne compatibilité avec votre profil"
            : "Good compatibility with your profile"
          : parsed.score >= 50
            ? locale === "fr"
              ? "Compatibilité correcte, quelques réserves"
              : "Fair compatibility, some reservations"
            : locale === "fr"
              ? "Compatibilité faible pour votre profil"
              : "Low compatibility for your profile"),
      personalized: Boolean(profile),
      source: "ai",
    };
  } catch (error) {
    console.error("[compatibility-ai]", error);
    return { ...computeCompatibilityRules(product, profile, answers), source: "rules" };
  }
}
