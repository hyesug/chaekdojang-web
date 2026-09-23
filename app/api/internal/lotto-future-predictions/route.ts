import { NextRequest, NextResponse } from "next/server";
import { generateFrozenPredictions } from "@/lib/lotto-future/predictor";

export const runtime = "nodejs";

type RequestBody = {
  round: number;
  drawDate: string;
  drawTime: string;
  history?: Array<{ round: number; drawDate: string; drawTime: string; numbers: number[] }>;
};

function validTicket(numbers: number[]) {
  return Array.isArray(numbers) && numbers.length === 6 && new Set(numbers).size === 6 && numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 45);
}

export async function POST(request: NextRequest) {
  const token = process.env.LOTTO_PREDICTION_INTERNAL_TOKEN;
  if (!token || request.headers.get("x-lotto-prediction-token") !== token) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json() as RequestBody;
  if (!Number.isInteger(body.round) || !/^\d{4}-\d{2}-\d{2}$/.test(body.drawDate) || !/^\d{2}:\d{2}/.test(body.drawTime)
      || (body.history ?? []).some((row) => !Number.isInteger(row.round) || !validTicket(row.numbers))) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const generated = generateFrozenPredictions(body, body.history ?? []);
  if (!Object.values(generated.predictions).every(validTicket)) return NextResponse.json({ error: "invalid model ticket" }, { status: 500 });
  return NextResponse.json(generated);
}
