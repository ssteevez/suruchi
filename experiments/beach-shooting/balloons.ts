export interface BalloonState {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  alive: boolean;
  colorTop: string;
  colorBottom: string;
  word: string;
}

export const BALLOON_WIDTH = 76;
export const BALLOON_HEIGHT = 152; // strict 1:2 ratio

export const COLS = 7;
export const ROWS = 4;
export const SPACING_X = 135;
export const SPACING_Y = 210;

// Row y offsets relative to boardCenterY (computed once, reused in renderer)
const GRID_START_Y = -((ROWS - 1) * SPACING_Y) / 2;

export { GRID_START_Y };

const PALETTES: Array<[string, string]> = [
  ['#FF8C00', '#DC143C'],  // Marigold / Vermillion
  ['#00CED1', '#FF69B4'],  // Cyan / Hot Pink
  ['#32CD32', '#8A2BE2'],  // Lime / Violet
  ['#4169E1', '#FF4500'],  // Cobalt / Orange Red
  ['#FFD700', '#FF1493'],  // Gold / Deep Pink
  ['#FF6347', '#1E90FF'],  // Tomato / Dodger Blue
  ['#ADFF2F', '#FF4500'],  // Chartreuse / Orange Red
  ['#FF1493', '#FFD700'],  // Deep Pink / Gold
  ['#00FA9A', '#FF4500'],  // Spring Green / Orange
];

const WORDS = ['i', 'am', 'not', 'happy', 'unhappy'] as const;

export function initBalloons(): BalloonState[] {
  const balloons: BalloonState[] = [];
  const startX = -((COLS - 1) * SPACING_X) / 2;
  let id = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const paletteIdx = Math.floor(Math.random() * PALETTES.length);
      const palette = PALETTES[paletteIdx] ?? PALETTES[0]!;
      const word = WORDS[Math.floor(Math.random() * WORDS.length)]!;
      balloons.push({
        id: id++,
        col: c,
        row: r,
        x: startX + c * SPACING_X,
        y: GRID_START_Y + r * SPACING_Y,
        alive: true,
        colorTop: palette[0],
        colorBottom: palette[1],
        word,
      });
    }
  }
  return balloons;
}

export function testHit(
  balloons: BalloonState[],
  worldAimX: number,
  worldAimY: number,
  boardCenterX: number,
  boardCenterY: number,
): BalloonState | null {
  for (const b of balloons) {
    if (!b.alive) continue;
    const cx = boardCenterX + b.x;
    const cy = boardCenterY + b.y;
    if (
      worldAimX >= cx - BALLOON_WIDTH / 2 &&
      worldAimX <= cx + BALLOON_WIDTH / 2 &&
      worldAimY >= cy - BALLOON_HEIGHT / 2 &&
      worldAimY <= cy + BALLOON_HEIGHT / 2
    ) {
      return b;
    }
  }
  return null;
}
