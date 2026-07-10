import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { apiError, apiNotConfigured } from "@/lib/apiErrors";

export const runtime = "nodejs";
export const maxDuration = 60;

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";
const REQUEST_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

type AnalyzeBody = {
  frames: string[];
  locale?: "en" | "fr";
};

function clampMetric(n: unknown, fallback = 70): number {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return apiNotConfigured("OPENAI_API_KEY is not set");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400, { code: "INVALID_JSON" });
  }

  const { frames, locale = "en" } = (body ?? {}) as AnalyzeBody;
  if (!Array.isArray(frames) || frames.length === 0) {
    return apiError("At least one frame is required", 400, { code: "NO_FRAMES" });
  }
  if (frames.length > 8) {
    return apiError("Maximum 8 frames allowed", 400, { code: "TOO_MANY_FRAMES" });
  }
  if (locale !== "en" && locale !== "fr") {
    return apiError('locale must be "en" or "fr"', 400, { code: "INVALID_LOCALE" });
  }

  const lang = locale === "fr" ? "French" : "English";

  try {
    const openai = new OpenAI({ apiKey });

    const response = await withTimeout(
      openai.chat.completions.create({
        model: VISION_MODEL,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a professional trichologist analyzing hair from video frames. Respond in ${lang}. Return valid JSON only.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these hair images. Return JSON with this exact structure:
{
  "score": <0-100 overall hair health>,
  "metrics": { "health", "hydration", "density", "porosity", "volume", "thickness", "elasticity", "scalp" } each 0-100,
  "detectedIssues": [<3-5 issues as strings>],
  "priorities": [<3 care priorities as strings>],
  "summary": "<2-3 sentence summary>"
}
Consider texture, shine, damage, curl pattern, scalp health, brittleness.`,
              },
              ...frames.slice(0, 5).map((frame) => ({
                type: "image_url" as const,
                image_url: {
                  url: frame.startsWith("data:") ? frame : `data:image/jpeg;base64,${frame}`,
                  detail: "low" as const,
                },
              })),
            ],
          },
        ],
      }),
      REQUEST_TIMEOUT_MS,
      "OpenAI request timed out"
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return apiError("Empty response from OpenAI", 502, { code: "EMPTY_RESPONSE" });
    }

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(content);
    } catch {
      return apiError("Could not parse AI response as JSON", 502, { code: "PARSE_ERROR" });
    }

    const metricsRaw = (analysis.metrics ?? {}) as Record<string, unknown>;
    const metrics = {
      health: clampMetric(metricsRaw.health),
      hydration: clampMetric(metricsRaw.hydration),
      density: clampMetric(metricsRaw.density),
      porosity: clampMetric(metricsRaw.porosity),
      volume: clampMetric(metricsRaw.volume),
      thickness: clampMetric(metricsRaw.thickness),
      elasticity: clampMetric(metricsRaw.elasticity),
      scalp: clampMetric(metricsRaw.scalp),
    };

    return NextResponse.json({
      configured: true,
      score: clampMetric(
        analysis.score,
        Math.round(Object.values(metrics).reduce((a, b) => a + b, 0) / 8)
      ),
      metrics,
      detectedIssues: Array.isArray(analysis.detectedIssues)
        ? analysis.detectedIssues.filter((x): x is string => typeof x === "string").slice(0, 5)
        : [],
      priorities: Array.isArray(analysis.priorities)
        ? analysis.priorities.filter((x): x is string => typeof x === "string").slice(0, 4)
        : [],
      summary: typeof analysis.summary === "string" ? analysis.summary : "",
    });
  } catch (error) {
    console.error("[analyze-hair]", error);
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    return apiError(message, 500, { code: "OPENAI_ERROR" });
  }
}
