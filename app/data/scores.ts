export type ScoreEntry = {
  rank: number;
  player: string;
  score: number;
  date: string; // "DD/MM/2026"
};

type Row = [player: string, score: number, date: string];

// Hand-written fixed leaderboards: 12 rows per game, sorted by score (desc).
const ROWS: Record<string, Row[]> = {
  "block-buster": [
    ["PX_KAI", 28450, "14/03/2026"],
    ["NEONFOX", 26980, "02/05/2026"],
    ["Z3R0COOL", 25310, "21/01/2026"],
    ["M00NRYU", 23740, "09/07/2026"],
    ["VAULT_07", 22100, "30/04/2026"],
    ["GLITCHA", 20865, "11/02/2026"],
    ["ATARI_KID", 19420, "18/06/2026"],
    ["CYBER_LU", 17990, "05/08/2026"],
    ["MAGENTA88", 16300, "27/03/2026"],
    ["SCANLINE", 14875, "12/09/2026"],
    ["BIT_LORD", 13210, "23/05/2026"],
    ["ARKADYA", 11640, "08/01/2026"],
  ],
  drop: [
    ["SCANLINE", 184220, "03/04/2026"],
    ["DROID_X", 171560, "19/02/2026"],
    ["RGB_QUEEN", 158900, "28/06/2026"],
    ["PX_KAI", 149335, "15/01/2026"],
    ["PIXEL_DAD", 137480, "07/09/2026"],
    ["NEONFOX", 126050, "22/03/2026"],
    ["RETROVIRA", 114720, "13/05/2026"],
    ["VECTORX", 103990, "01/07/2026"],
    ["JOY_STK", 92410, "26/04/2026"],
    ["GLITCHA", 81275, "10/08/2026"],
    ["M00NRYU", 70640, "17/02/2026"],
    ["CYBER_LU", 59380, "04/06/2026"],
  ],
  serpentine: [
    ["JOY_STK", 7820, "06/05/2026"],
    ["BIT_LORD", 7340, "24/03/2026"],
    ["Z3R0COOL", 6915, "12/01/2026"],
    ["ARKADYA", 6480, "29/07/2026"],
    ["MAGENTA88", 6050, "16/04/2026"],
    ["VAULT_07", 5610, "02/09/2026"],
    ["PIXEL_DAD", 5175, "20/02/2026"],
    ["DROID_X", 4730, "08/06/2026"],
    ["NEONFOX", 4290, "31/05/2026"],
    ["ATARI_KID", 3855, "14/08/2026"],
    ["VECTORX", 3410, "25/01/2026"],
    ["PX_KAI", 2970, "03/03/2026"],
  ],
  glutton: [
    ["ATARI_KID", 96400, "09/02/2026"],
    ["CYBER_LU", 91250, "27/05/2026"],
    ["RETROVIRA", 86730, "18/03/2026"],
    ["M00NRYU", 81100, "04/07/2026"],
    ["SCANLINE", 75985, "21/04/2026"],
    ["RGB_QUEEN", 70410, "13/01/2026"],
    ["GLITCHA", 64820, "30/08/2026"],
    ["PX_KAI", 59375, "06/06/2026"],
    ["BIT_LORD", 53940, "25/02/2026"],
    ["VAULT_07", 48260, "11/09/2026"],
    ["ARKADYA", 42715, "15/05/2026"],
    ["JOY_STK", 37090, "01/04/2026"],
  ],
  invaders: [
    ["VECTORX", 54190, "22/06/2026"],
    ["NEONFOX", 51480, "10/03/2026"],
    ["DROID_X", 48725, "05/01/2026"],
    ["PIXEL_DAD", 45960, "17/08/2026"],
    ["Z3R0COOL", 43210, "28/04/2026"],
    ["MAGENTA88", 40375, "14/02/2026"],
    ["CYBER_LU", 37840, "03/07/2026"],
    ["SCANLINE", 35105, "19/05/2026"],
    ["PX_KAI", 32660, "09/09/2026"],
    ["RGB_QUEEN", 29930, "26/03/2026"],
    ["GLITCHA", 27285, "12/06/2026"],
    ["ATARI_KID", 24510, "07/02/2026"],
  ],
  rocks: [
    ["GLITCHA", 41200, "16/07/2026"],
    ["M00NRYU", 39560, "01/03/2026"],
    ["ARKADYA", 37985, "23/05/2026"],
    ["BIT_LORD", 36240, "11/01/2026"],
    ["VAULT_07", 34410, "29/08/2026"],
    ["RETROVIRA", 32790, "08/04/2026"],
    ["JOY_STK", 30955, "20/06/2026"],
    ["PX_KAI", 29120, "04/02/2026"],
    ["NEONFOX", 27380, "13/09/2026"],
    ["VECTORX", 25640, "27/01/2026"],
    ["DROID_X", 23815, "15/03/2026"],
    ["MAGENTA88", 21970, "02/07/2026"],
  ],
  froggy: [
    ["PIXEL_DAD", 18900, "10/04/2026"],
    ["RGB_QUEEN", 17650, "26/02/2026"],
    ["SCANLINE", 16480, "14/06/2026"],
    ["CYBER_LU", 15230, "03/01/2026"],
    ["Z3R0COOL", 14075, "21/08/2026"],
    ["ATARI_KID", 12940, "18/05/2026"],
    ["NEONFOX", 11720, "07/03/2026"],
    ["BIT_LORD", 10585, "30/07/2026"],
    ["GLITCHA", 9360, "12/02/2026"],
    ["VAULT_07", 8215, "24/09/2026"],
    ["JOY_STK", 7090, "05/04/2026"],
    ["ARKADYA", 5870, "16/06/2026"],
  ],
  "pixel-duel": [
    ["MAGENTA88", 24, "08/05/2026"],
    ["VECTORX", 22, "19/03/2026"],
    ["PX_KAI", 21, "02/01/2026"],
    ["DROID_X", 19, "27/07/2026"],
    ["M00NRYU", 18, "13/04/2026"],
    ["RETROVIRA", 16, "06/09/2026"],
    ["SCANLINE", 15, "22/02/2026"],
    ["NEONFOX", 13, "31/05/2026"],
    ["CYBER_LU", 12, "10/08/2026"],
    ["JOY_STK", 10, "17/01/2026"],
    ["GLITCHA", 8, "04/06/2026"],
    ["PIXEL_DAD", 6, "25/03/2026"],
  ],
};

export async function getLeaderboard(
  gameId: string,
  limit?: number,
): Promise<ScoreEntry[]> {
  const rows = (ROWS[gameId] ?? []).map(([player, score, date], i) => ({
    rank: i + 1,
    player,
    score,
    date,
  }));
  return limit === undefined ? rows : rows.slice(0, limit);
}

// Fixed mock: the signed-in player's best entry (same for every user/game).
export async function getPlayerBest(
  gameId: string,
  player: string,
): Promise<ScoreEntry> {
  const rows = ROWS[gameId] ?? [];
  const lastScore = rows.at(-1)?.[1] ?? 0;
  return {
    rank: rows.length + 1,
    player,
    score: Math.max(Math.floor(lastScore * 0.85), 1),
    date: "01/11/2026",
  };
}
