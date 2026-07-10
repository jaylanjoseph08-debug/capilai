import type { Answers } from "./store";
import type { Locale } from "./locale";
import type { HairProfile } from "./mockAnalysis";
import { buildHairProfile } from "./mockAnalysis";
import { generateRoutine } from "./hairAnalysisHelpers";

/** Re-localize profile text for the active UI language (scores/metrics stay from analysis). */
export function getProfileForLocale(
  profile: HairProfile,
  answers: Answers,
  locale: Locale
): HairProfile {
  const textProfile = buildHairProfile(answers, locale);
  const routine = generateRoutine(profile.metrics, answers, locale);

  return {
    ...textProfile,
    score: profile.score,
    metrics: profile.metrics,
    generatedAt: profile.generatedAt,
    locale,
    routine,
  };
}
