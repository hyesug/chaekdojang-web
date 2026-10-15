"use client";

import { LEADERBOARD_RULE_LABELS } from "@/lib/lotto-future/leaderboard-labels";

export interface LottoLeaderboardEntry {
  ruleId: string;
  numbers: number[];
  rank: number | null;
  score: number | null;
  recordRounds: number;
  recordMean: number | null;
  recentMean: number | null;
  top5Rank: number | null;
  modelVersion: string;
  engineVersion: string;
  generatedAt: string;
  revision: number;
  hitCount: number;
  hitNumbers: number[];
  official: boolean;
  detail: string | null;
}

interface LeaderboardRound {
  round: number;
  drawDate: string;
  drawTime: string;
  actualNumbers: number[] | null;
  leaderboard?: LottoLeaderboardEntry[];
}

const RANDOM_MEAN = 0.8;
const fixed = (value: number | null | undefined, digits = 3) => value == null ? "-" : value.toFixed(digits);
const sorted = (numbers: number[]) => [...numbers].sort((a, b) => a - b);
const topFive = (round: LeaderboardRound) => (round.leaderboard ?? []).filter((entry) => entry.top5Rank != null).sort((a, b) => (a.top5Rank ?? 9) - (b.top5Rank ?? 9));

function RuleName({ ruleId }: { ruleId: string }) {
  const label = LEADERBOARD_RULE_LABELS[ruleId];
  return <>{label?.name ?? ruleId}<span className="ml-1.5 text-[11px] font-normal text-brown-400">{ruleId}{label ? ` · ${label.engine} 엔진` : ""}</span></>;
}

function Balls({ numbers, hits }: { numbers: number[]; hits?: number[] }) {
  return <div className="mt-2 flex flex-wrap gap-1.5">{sorted(numbers).map((number) => <span key={number} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${hits?.includes(number) ? "bg-amber-500 text-white" : "bg-brown-700 text-white"}`}>{number}</span>)}</div>;
}

// 정식 성적: 추첨 전에 저장되고 결과가 확정된 회차의 상위 5개만 집계한다.
function officialScore(rounds: LeaderboardRound[]) {
  const scored = rounds.filter((round) => round.actualNumbers).map((round) => topFive(round).filter((entry) => entry.official)).filter((entries) => entries.length);
  const all = scored.flat();
  return {
    rounds: scored.length,
    top5Mean: all.length ? all.reduce((sum, entry) => sum + entry.hitCount, 0) / all.length : null,
    firstMean: scored.length ? scored.reduce((sum, entries) => sum + (entries.find((entry) => entry.top5Rank === 1)?.hitCount ?? 0), 0) / scored.length : null,
    best: all.length ? Math.max(...all.map((entry) => entry.hitCount)) : null,
  };
}

export function LottoLeaderboardPanel({ rounds, drawHasPassed, generating, onGenerate }: {
  rounds: LeaderboardRound[];
  drawHasPassed: (round: LeaderboardRound) => boolean;
  generating: boolean;
  onGenerate: (round: number) => void;
}) {
  const current = rounds[0];
  if (!current) return null;
  const board = current.leaderboard ?? [];
  const top = topFive(current);
  const meta = board[0];
  const score = officialScore(rounds);
  const history = rounds.filter((round) => topFive(round).length);
  return <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-serif text-lg font-bold text-brown-900">변동 순위표 · 누적 성적 상위 5개 규칙</h3>
        <p className="mt-1 text-sm text-brown-500">기존·최신 엔진 규칙과 매주 다시 학습하는 신규 규칙 57개를 그 회차 이전 성적으로 다시 줄 세웁니다. 같은 번호를 내는 규칙은 하나만 올립니다.</p>
        <p className="mt-1 text-xs text-brown-400">순위는 지금까지의 성적이지 당첨 확률이 아닙니다. 701–1245회에 이 방식을 그대로 적용했을 때 상위 5개 평균 적중은 무작위({RANDOM_MEAN}개)와 차이가 없었습니다.</p>
      </div>
      {!drawHasPassed(current) && <button type="button" onClick={() => onGenerate(current.round)} disabled={generating} className="rounded-lg border border-cream-300 px-3 py-2 text-xs text-brown-600 hover:bg-cream-50 disabled:opacity-50">{generating ? "계산 중" : board.length ? "순위표 다시 생성" : "순위표 생성"}</button>}
    </div>
    {!board.length ? <p className="mt-4 text-sm text-brown-500">{current.round}회 순위표가 아직 없습니다.{drawHasPassed(current) ? " 추첨이 지나 새로 만들 수 없습니다." : ""}</p> : <>
      <p className="mt-3 text-xs text-brown-400">{current.round}회 · 생성 {meta.generatedAt.replace("T", " ").slice(0, 16)} · {meta.modelVersion} · 엔진 {meta.engineVersion} · revision {meta.revision}{meta.official ? "" : " · 추첨 후 생성(정식 성적 제외)"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((entry) => <div key={entry.ruleId} className="rounded-xl bg-cream-50 p-3">
          <p className="text-xs font-semibold text-amber-700">{entry.top5Rank}위 · 전체 {entry.rank}위</p>
          <p className="mt-1 font-semibold text-brown-800"><RuleName ruleId={entry.ruleId} /></p>
          {entry.detail && <p className="mt-1 text-xs leading-5 text-brown-600">{entry.detail}</p>}
          <p className="mt-1 text-xs text-brown-500">점수 {fixed(entry.score, 4)} · 누적 {entry.recordRounds}회 평균 {fixed(entry.recordMean)}개 · 최근 104회 {fixed(entry.recentMean)}개</p>
          <Balls numbers={entry.numbers} hits={current.actualNumbers ? entry.hitNumbers : undefined} />
          {current.actualNumbers && <p className="mt-2 text-sm text-brown-700">적중 {entry.hitCount}개</p>}
        </div>)}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-brown-600">전체 순위 {board.length}개 보기</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="text-left text-brown-500"><tr><th className="px-3 py-2">순위</th><th className="px-3 py-2">규칙</th><th className="px-3 py-2">점수</th><th className="px-3 py-2">누적(회)</th><th className="px-3 py-2">최근 104회</th><th className="px-3 py-2">번호</th>{current.actualNumbers && <th className="px-3 py-2">적중</th>}</tr></thead>
          <tbody>{board.map((entry) => <tr key={entry.ruleId} className={`border-t border-cream-100 ${entry.top5Rank ? "bg-amber-50" : ""}`}>
            <td className="px-3 py-2 text-brown-800">{entry.rank ?? "기록 부족"}{entry.top5Rank ? ` (상위 ${entry.top5Rank})` : ""}</td>
            <td className="px-3 py-2 text-brown-800"><RuleName ruleId={entry.ruleId} />{entry.detail && <p className="mt-1 max-w-md text-xs text-brown-500">{entry.detail}</p>}</td>
            <td className="px-3 py-2 text-brown-600">{fixed(entry.score, 4)}</td>
            <td className="px-3 py-2 text-brown-600">{fixed(entry.recordMean)} ({entry.recordRounds})</td>
            <td className="px-3 py-2 text-brown-600">{fixed(entry.recentMean)}</td>
            <td className="px-3 py-2 text-brown-700">{sorted(entry.numbers).join(", ")}</td>
            {current.actualNumbers && <td className="px-3 py-2 text-brown-700">{entry.hitCount}</td>}
          </tr>)}</tbody></table></div>
      </details>
    </>}
    <div className="mt-5 rounded-xl border border-cream-200 p-4">
      <h4 className="font-semibold text-brown-800">매주 상위 5개 기록</h4>
      <p className="mt-1 text-xs text-brown-400">회차마다 추첨 전에 저장된 상위 5개 규칙과 번호입니다. 당첨번호와 겹친 번호는 노란색입니다. 무작위 기대는 1장당 {RANDOM_MEAN}개입니다.</p>
      <p className="mt-2 text-sm text-brown-700">{score.rounds ? `정식 집계 ${score.rounds}회 · 상위 5개 평균 ${fixed(score.top5Mean, 2)}개 · 1위 규칙 평균 ${fixed(score.firstMean, 2)}개 · 최고 ${score.best}/6` : "아직 당첨번호가 확정된 회차가 없어요"}</p>
      {history.length > 0 && <div className="mt-3 space-y-3">{history.map((round) => <div key={round.round} className="rounded-lg bg-cream-50 p-3">
        <p className="text-sm font-semibold text-brown-800">{round.round}회 <span className="font-normal text-brown-500">· {round.drawDate}</span>{round.actualNumbers ? <span className="ml-2 font-normal text-brown-700">당첨번호 {sorted(round.actualNumbers).join(", ")}</span> : <span className="ml-2 font-normal text-brown-400">추첨 전</span>}</p>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><tbody>{topFive(round).map((entry) => <tr key={entry.ruleId} className="border-t border-cream-100">
          <td className="w-10 px-2 py-1.5 text-brown-500">{entry.top5Rank}위</td>
          <td className="px-2 py-1.5 text-brown-800">{LEADERBOARD_RULE_LABELS[entry.ruleId]?.name ?? entry.ruleId}<span className="ml-1 text-[11px] text-brown-400">{entry.ruleId}</span></td>
          <td className="px-2 py-1.5"><div className="flex flex-wrap gap-1">{sorted(entry.numbers).map((number) => <span key={number} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${round.actualNumbers?.includes(number) ? "bg-amber-500 text-white" : "bg-brown-700 text-white"}`}>{number}</span>)}</div></td>
          <td className="w-24 px-2 py-1.5 text-right text-brown-700">{round.actualNumbers ? <>적중 <b>{entry.hitCount}</b>{entry.official ? "" : " (비정식)"}</> : "-"}</td>
        </tr>)}</tbody></table></div>
      </div>)}</div>}
    </div>
  </div>;
}
