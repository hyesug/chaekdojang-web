/**
 * lotto-model.js — 로또 통계 검증 결과 (자동 생성 파일)
 *
 * 직접 고치지 마세요. `node scripts/lotto-verify.mjs` 가 덮어씁니다.
 *
 * 검증은 무겁다(회차 천 개면 수십 초). 화면을 열 때마다 돌릴 수 없으므로
 * 미리 한 번 돌려 결과만 여기 적어 두고, 브라우저는 이 값을 읽기만 한다.
 * 새 회차가 쌓이면 스크립트를 다시 돌린다.
 *
 * 아래는 과거 회차 데이터가 아직 없을 때의 기본값이다.
 * 이 상태에서는 통계가 번호 선택에 전혀 관여하지 않는다 — lotto.js 가
 * 지금까지 해오던 대로 명반 겹침으로만 고른다.
 */

export const LOTTO_MODEL = {
  "modelVersion": "lotto-stat-1.1.0",
  "drawCount": 1241,
  "used": [],
  "weights": {
    "빈도": 0,
    "최근": 0,
    "간격": 0,
    "추세": 0,
    "전이": 0,
    "이월": 0,
    "N-2": 0,
    "구간": 0
  },
  "statWeight": 0,
  "verdicts": [
    {
      "name": "빈도",
      "scale": 0.05,
      "gain": -0.0009521597132802206,
      "chance": 0,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "최근",
      "scale": 0.05,
      "gain": -0.000642525357649415,
      "chance": 0,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "간격",
      "scale": 0.05,
      "gain": -0.00011450684257452437,
      "chance": 0.0004298988486426403,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "추세",
      "scale": 0.05,
      "gain": -0.0008132312135802344,
      "chance": 0,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "전이",
      "scale": 0.05,
      "gain": -0.001038367021599429,
      "chance": 0,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "이월",
      "scale": 0.05,
      "gain": -0.0009623805512781747,
      "chance": 0,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "N-2",
      "scale": 0.05,
      "gain": -0.00048802649805312903,
      "chance": 0.00041834149622133054,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    },
    {
      "name": "구간",
      "scale": 0.05,
      "gain": -0.0007208956979432024,
      "chance": 0.00026311602336115403,
      "rolls": 0,
      "weight": 0,
      "note": "무작위보다 나쁩니다"
    }
  ],
  "ablation": [],
  "comparison": [
    {
      "label": "무작위",
      "averageMatches": 0.7580645161290323,
      "hit3PlusRate": 0.004032258064516129,
      "brierScore": 0.11555555555555581,
      "logLoss": 0.3926744672275508,
      "skill": -2.220446049250313e-15
    },
    {
      "label": "빈도만",
      "averageMatches": 0.75,
      "hit3PlusRate": 0.012096774193548387,
      "brierScore": 0.1158644991337356,
      "logLoss": 0.394009430992537,
      "skill": -0.002673550195788854
    },
    {
      "label": "빈도+최근",
      "averageMatches": 0.7661290322580645,
      "hit3PlusRate": 0.016129032258064516,
      "brierScore": 0.11608705449014405,
      "logLoss": 0.3949869882143251,
      "skill": -0.004599510010861785
    },
    {
      "label": "빈도+전이",
      "averageMatches": 0.7096774193548387,
      "hit3PlusRate": 0.012096774193548387,
      "brierScore": 0.11693370116619764,
      "logLoss": 0.398943986393754,
      "skill": -0.011926260092094854
    },
    {
      "label": "빈도+전이+구간",
      "averageMatches": 0.7419354838709677,
      "hit3PlusRate": 0.008064516129032258,
      "brierScore": 0.11723101026794837,
      "logLoss": 0.40053596540042924,
      "skill": -0.014499127318783778
    },
    {
      "label": "통계 전체",
      "averageMatches": 0.7298387096774194,
      "hit3PlusRate": 0.024193548387096774,
      "brierScore": 0.11774831992379373,
      "logLoss": 0.40293498384752247,
      "skill": -0.018975845494368704
    }
  ],
  "split": {
    "trainTo": 744,
    "validTo": 992,
    "testTo": 1241,
    "minTrain": 300
  },
  "finalTest": {
    "sampleSize": 249,
    "averageMatches": 0.7389558232931727,
    "hit3PlusRate": 0.020080321285140562,
    "hit4PlusRate": 0,
    "hit5PlusRate": 0,
    "brierScore": 0.11555555555555583,
    "logLoss": 0.39267446722755084,
    "matchDistribution": [
      110,
      99,
      35,
      5,
      0,
      0,
      0
    ]
  },
  "testBaseline": {
    "sims": 200,
    "seed": 47710,
    "sampleSize": 49800,
    "averageMatches": 0.8034136546184739,
    "hit3PlusRate": 0.02493975903614458,
    "hit4PlusRate": 0.0014457831325301205,
    "hit5PlusRate": 0,
    "brierScore": 0.11555555555555556,
    "logLoss": 0.3926744672275521,
    "matchDistribution": [
      19902,
      21100,
      7556,
      1170,
      72,
      0,
      0
    ]
  },
  "rolling": [
    {
      "window": 20,
      "sampleSize": 20,
      "averageMatches": 0.5,
      "hit3PlusRate": 0,
      "skill": -6.661338147750939e-16
    },
    {
      "window": 50,
      "sampleSize": 50,
      "averageMatches": 0.72,
      "hit3PlusRate": 0.02,
      "skill": -1.1102230246251565e-15
    },
    {
      "window": 100,
      "sampleSize": 100,
      "averageMatches": 0.75,
      "hit3PlusRate": 0.02,
      "skill": -1.7763568394002505e-15
    }
  ],
  "reason": "8개 신호 모두 무작위를 이기지 못했습니다. 통계는 번호 선택에 쓰지 않습니다.",
  "verifiedAt": "2026-09-19"
};
