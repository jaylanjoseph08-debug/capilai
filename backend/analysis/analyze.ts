import { api, APIError } from "encore.dev/api";
import { analyzeHairWithOpenAI, type AnalyzeHairInput, type AnalyzeHairResult } from "./lib/openai";

export type AnalyzeHairRequest = AnalyzeHairInput;

export type AnalyzeHairResponse =
  | AnalyzeHairResult
  | {
      configured: false;
      error: string;
    };

/**
 * Analyse capillaire à partir d'images extraites d'une vidéo.
 * Compatible avec le contrat de l'ancienne route Next.js `/api/analyze-hair`.
 */
export const analyzeHair = api(
  {
    expose: true,
    method: "POST",
    path: "/analyze-hair",
  },
  async (req: AnalyzeHairRequest): Promise<AnalyzeHairResponse> => {
    const frames = req.frames ?? [];
    const locale = req.locale ?? "en";

    if (!Array.isArray(frames) || frames.length === 0) {
      throw APIError.invalidArgument("At least one frame is required");
    }
    if (frames.length > 8) {
      throw APIError.invalidArgument("Maximum 8 frames allowed");
    }
    if (locale !== "en" && locale !== "fr") {
      throw APIError.invalidArgument('locale must be "en" or "fr"');
    }

    try {
      return await analyzeHairWithOpenAI({ frames, locale });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown analysis error";

      if (message.includes("secret is not set") || message.includes("OpenAIAPIKey")) {
        return {
          configured: false,
          error: "OpenAIAPIKey secret is not set. Run: encore secret set --type dev,local OpenAIAPIKey",
        };
      }

      if (message.includes("timed out")) {
        throw APIError.deadlineExceeded(message);
      }
      if (message.includes("parse") || message.includes("Empty response")) {
        throw APIError.internal(message);
      }

      throw APIError.internal(message);
    }
  }
);

/** Health check for monitoring and frontend connectivity tests. */
export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<{ ok: true; service: "analysis" }> => {
    return { ok: true, service: "analysis" };
  }
);
