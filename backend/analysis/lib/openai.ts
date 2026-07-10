import OpenAI from "openai";
import { secret } from "encore.dev/config";
import { averageScore, clampMetric, normalizeMetrics, type HairMetrics } from "./metrics";

const openAIAPIKey = secret("OpenAIAPIKey");

const VISION_MODEL = "gpt-4o";
const REQUEST_TIMEOUT_MS = 55_000;

export type Locale = "en" | "fr";

export type AnalyzeHairInput = {
  frames: string[];
  locale?: Locale;
};

export type AnalyzeHairResult = {
  configured: true;
  score: number;
  metrics: HairMetrics;
  detectedIssues: string[];
  priorities: string[];
  summary: string;
};

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

function frameToImageUrl(frame: string): string {
  return frame.startsWith("data:") ? frame : `data:image/jpeg;base64,${frame}`;
}

export async function analyzeHairWithOpenAI(input: AnalyzeHairInput): Promise<AnalyzeHairResult> {
  const apiKey = openAIAPIKey();
  if (!apiKey) {
    throw new Error("OpenAIAPIKey secret is not set");
  }

  const locale = input.locale ?? "en";
  const lang = locale === "fr" ? "French" : "English";
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
            ...input.frames.slice(0, 5).map((frame) => ({
              type: "image_url" as const,
              image_url: {
                url: frameToImageUrl(frame),
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
    throw new Error("Empty response from OpenAI");
  }

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(content);
  } catch {
    throw new Error("Could not parse AI response as JSON");
  }

  const metrics = normalizeMetrics((analysis.metrics ?? {}) as Record<string, unknown>);
  const score = clampMetric(analysis.score, averageScore(metrics));

  return {
    configured: true,
    score,
    metrics,
    detectedIssues: Array.isArray(analysis.detectedIssues)
      ? analysis.detectedIssues.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [],
    priorities: Array.isArray(analysis.priorities)
      ? analysis.priorities.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [],
    summary: typeof analysis.summary === "string" ? analysis.summary : "",
  };
}
