import { NextRequest, NextResponse } from "next/server";
import { generateLeaderboard, type LeaderboardResult } from "@/lib/lotto-future/leaderboard";

export const runtime = "nodejs";
// 득표 규칙군 재학습·1–1245 기준선 갱신에 수 초가 걸린다.
export const maxDuration = 60;

type RequestBody = {
  round: number;
  drawDate: string;
  drawTime: string;
  history?: Array<{ round: number; drawDate: string; drawTime: string; numbers: number[] }>;
  results?: LeaderboardResult[];
};

function validTicket(numbers: number[]) {
  return Array.isArray(numbers) && numbers.length === 6 && new Set(numbers).size === 6 && numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 45);
}

export async function POST(request: NextRequest) {
  const token = process.env.LOTTO_PREDICTION_INTERNAL_TOKEN;
  if (!token || request.headers.get("x-lotto-prediction-token") !== token) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json() as RequestBody;
  if (!Number.isInteger(body.round) || !/^\d{4}-\d{2}-\d{2}$/.test(body.drawDate) || !/^\d{2}:\d{2}/.test(body.drawTime)
      || (body.history ?? []).some((row) => !Number.isInteger(row.round) || !validTicket(row.numbers))
      || (body.results ?? []).some((row) => !Number.isInteger(row.round) || !validTicket(row.actual) || !Object.values(row.tickets ?? {}).every(validTicket))) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    return NextResponse.json(generateLeaderboard(body, body.history ?? [], body.results ?? []));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "leaderboard failed" }, { status: 422 });
  }
}
