import { NextRequest, NextResponse } from "next/server";
import type { Product } from "@/lib/products";
import type { HairProfile } from "@/lib/mockAnalysis";
import type { Answers } from "@/lib/store";
import { runProductCompatibilityAI } from "@/lib/compatibility-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeProductBody = {
  product: Product;
  profile: HairProfile | null;
  answers: Answers;
  locale?: "en" | "fr";
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product, profile, answers, locale = "fr" } = (body ?? {}) as AnalyzeProductBody;
  if (!product?.name) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }

  const result = await runProductCompatibilityAI(product, profile ?? null, answers ?? {}, locale);
  return NextResponse.json(result);
}
