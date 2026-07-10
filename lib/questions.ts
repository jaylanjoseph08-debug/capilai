import type { Locale } from "./locale";

export type QuestionType = "single" | "multi" | "slider";

export interface Question {
  id: string;
  title: string;
  subtitle?: string;
  type: QuestionType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const questionsByLocale: Record<Locale, Question[]> = {
  en: [
    {
      id: "gender",
      title: "You are…",
      type: "single",
      options: [
        { value: "homme", label: "Man" },
        { value: "femme", label: "Woman" },
        { value: "autre", label: "Other" },
      ],
    },
    {
      id: "age",
      title: "How old are you?",
      type: "slider",
      min: 12,
      max: 80,
      step: 1,
      unit: "years",
    },
    {
      id: "hairType",
      title: "What is your hair type?",
      type: "single",
      options: [
        { value: "lisses", label: "Straight" },
        { value: "ondules", label: "Wavy" },
        { value: "boucles", label: "Curly" },
        { value: "frises", label: "Coily" },
        { value: "crepus", label: "Kinky" },
      ],
    },
    {
      id: "length",
      title: "How long is your hair?",
      type: "single",
      options: [
        { value: "tres_courts", label: "Very short" },
        { value: "courts", label: "Short" },
        { value: "mi_longs", label: "Medium" },
        { value: "longs", label: "Long" },
        { value: "tres_longs", label: "Very long" },
      ],
    },
    {
      id: "hairstyle",
      title: "What hairstyle do you currently wear?",
      type: "single",
      options: [
        { value: "afro", label: "Afro" },
        { value: "tresses", label: "Braids" },
        { value: "vanilles", label: "Twists" },
        { value: "locks", label: "Locs" },
        { value: "queue_de_cheval", label: "Ponytail" },
        { value: "chignon", label: "Bun" },
        { value: "laches", label: "Loose hair" },
        { value: "coupe_courte", label: "Short cut" },
        { value: "autre", label: "Other" },
      ],
    },
    {
      id: "washFrequency",
      title: "How often do you wash your hair?",
      type: "single",
      options: [
        { value: "quotidien", label: "Every day" },
        { value: "2_3_semaine", label: "2–3 times a week" },
        { value: "hebdo", label: "Once a week" },
        { value: "moins", label: "Less than once a week" },
      ],
    },
    {
      id: "scalpBehavior",
      title: "How does your scalp behave between washes?",
      subtitle: "Multiple answers possible",
      type: "multi",
      options: [
        { value: "tres_sec", label: "Very dry" },
        { value: "sec", label: "Dry" },
        { value: "normal", label: "Normal" },
        { value: "gras", label: "Oily" },
        { value: "tres_gras", label: "Very oily" },
        { value: "pellicules", label: "Dandruff" },
        { value: "demangeaisons", label: "Itchy" },
        { value: "sensible", label: "Sensitive" },
      ],
    },
    {
      id: "recentTreatments",
      title: "Have you recently had…",
      type: "multi",
      options: [
        { value: "coloration", label: "Color treatment" },
        { value: "decoloration", label: "Bleaching" },
        { value: "lissage", label: "Straightening" },
        { value: "permanente", label: "Perm" },
        { value: "aucun", label: "None" },
      ],
    },
    {
      id: "goals",
      title: "What are your goals?",
      subtitle: "Multiple answers possible",
      type: "multi",
      options: [
        { value: "pousse", label: "Boost growth" },
        { value: "casse", label: "Reduce breakage" },
        { value: "volume", label: "More volume" },
        { value: "hydratation", label: "Hydrate" },
        { value: "reparation", label: "Repair" },
        { value: "definition_boucles", label: "Define curls" },
        { value: "frisottis", label: "Reduce frizz" },
        { value: "pellicules", label: "Reduce dandruff" },
      ],
    },
    {
      id: "knowledgeLevel",
      title: "What is your hair care knowledge level?",
      type: "single",
      options: [
        { value: "debutant", label: "Beginner" },
        { value: "intermediaire", label: "Intermediate" },
        { value: "avance", label: "Advanced" },
      ],
    },
  ],
  fr: [
    {
      id: "gender",
      title: "Vous êtes…",
      type: "single",
      options: [
        { value: "homme", label: "Homme" },
        { value: "femme", label: "Femme" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      id: "age",
      title: "Quel âge avez-vous ?",
      type: "slider",
      min: 12,
      max: 80,
      step: 1,
      unit: "ans",
    },
    {
      id: "hairType",
      title: "Quel est votre type de cheveux ?",
      type: "single",
      options: [
        { value: "lisses", label: "Lisses" },
        { value: "ondules", label: "Ondulés" },
        { value: "boucles", label: "Bouclés" },
        { value: "frises", label: "Frisés" },
        { value: "crepus", label: "Crépus" },
      ],
    },
    {
      id: "length",
      title: "Quelle est la longueur de vos cheveux ?",
      type: "single",
      options: [
        { value: "tres_courts", label: "Très courts" },
        { value: "courts", label: "Courts" },
        { value: "mi_longs", label: "Mi-longs" },
        { value: "longs", label: "Longs" },
        { value: "tres_longs", label: "Très longs" },
      ],
    },
    {
      id: "hairstyle",
      title: "Quelle coiffure portez-vous actuellement ?",
      type: "single",
      options: [
        { value: "afro", label: "Afro" },
        { value: "tresses", label: "Tresses" },
        { value: "vanilles", label: "Vanilles" },
        { value: "locks", label: "Locks" },
        { value: "queue_de_cheval", label: "Queue de cheval" },
        { value: "chignon", label: "Chignon" },
        { value: "laches", label: "Cheveux lâchés" },
        { value: "coupe_courte", label: "Coupe courte" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      id: "washFrequency",
      title: "À quelle fréquence lavez-vous vos cheveux ?",
      type: "single",
      options: [
        { value: "quotidien", label: "Tous les jours" },
        { value: "2_3_semaine", label: "2 à 3 fois par semaine" },
        { value: "hebdo", label: "Une fois par semaine" },
        { value: "moins", label: "Moins d'une fois par semaine" },
      ],
    },
    {
      id: "scalpBehavior",
      title: "Comment se comporte votre cuir chevelu entre deux lavages ?",
      subtitle: "Plusieurs réponses possibles",
      type: "multi",
      options: [
        { value: "tres_sec", label: "Très sec" },
        { value: "sec", label: "Sec" },
        { value: "normal", label: "Normal" },
        { value: "gras", label: "Gras" },
        { value: "tres_gras", label: "Très gras" },
        { value: "pellicules", label: "Pellicules" },
        { value: "demangeaisons", label: "Démangeaisons" },
        { value: "sensible", label: "Sensible" },
      ],
    },
    {
      id: "recentTreatments",
      title: "Avez-vous réalisé récemment…",
      type: "multi",
      options: [
        { value: "coloration", label: "Coloration" },
        { value: "decoloration", label: "Décoloration" },
        { value: "lissage", label: "Lissage" },
        { value: "permanente", label: "Permanente" },
        { value: "aucun", label: "Aucun" },
      ],
    },
    {
      id: "goals",
      title: "Quels sont vos objectifs ?",
      subtitle: "Plusieurs réponses possibles",
      type: "multi",
      options: [
        { value: "pousse", label: "Favoriser la pousse" },
        { value: "casse", label: "Réduire la casse" },
        { value: "volume", label: "Plus de volume" },
        { value: "hydratation", label: "Hydrater" },
        { value: "reparation", label: "Réparer" },
        { value: "definition_boucles", label: "Définir les boucles" },
        { value: "frisottis", label: "Réduire les frisottis" },
        { value: "pellicules", label: "Diminuer les pellicules" },
      ],
    },
    {
      id: "knowledgeLevel",
      title: "Quel est votre niveau de connaissance capillaire ?",
      type: "single",
      options: [
        { value: "debutant", label: "Débutant" },
        { value: "intermediaire", label: "Intermédiaire" },
        { value: "avance", label: "Avancé" },
      ],
    },
  ],
};

export function getQuestions(locale: Locale): Question[] {
  return questionsByLocale[locale] ?? questionsByLocale.en;
}

/** @deprecated use getQuestions(locale) */
export const questions = questionsByLocale.fr;
