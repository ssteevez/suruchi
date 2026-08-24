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
  rotation: number;
}

export const BALLOON_WIDTH = 76;
export const BALLOON_HEIGHT = 100; // slightly rounder

export const COLS = 10;
export const ROWS = 9;
export const SPACING_X = 74;
export const SPACING_Y = 76;

// Row y offsets relative to boardCenterY (computed once, reused in renderer)
const GRID_START_Y = -((ROWS - 1) * SPACING_Y) / 2;

export { GRID_START_Y };

const PALETTES: Array<[string, string]> = [
  ['#d92c3a', '#b7222f'], // Red
  ['#f3752b', '#d36220'], // Orange
  ['#facf15', '#d9b20b'], // Yellow
  ['#00a651', '#008741'], // Green
  ['#1c75bc', '#165c96'], // Blue
  ['#662d91', '#4f2272'], // Purple
];

const WORDS = ['I', 'AM', 'NOT', 'HAPPY', 'UNHAPPY'] as const;

export function initBalloons(): BalloonState[] {
  const balloons: BalloonState[] = [];
  // Center is offset by half the stagger (SPACING_X / 4)
  const startX = -((COLS - 1) * SPACING_X) / 2 - (SPACING_X / 4);
  let id = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const paletteIdx = Math.floor(Math.random() * PALETTES.length);
      const palette = PALETTES[paletteIdx] ?? PALETTES[0]!;
      const word = WORDS[Math.floor(Math.random() * WORDS.length)]!;
      
      const stagger = (r % 2) * (SPACING_X / 2);
      
      balloons.push({
        id: id++,
        col: c,
        row: r,
        x: startX + c * SPACING_X + stagger,
        y: GRID_START_Y + r * SPACING_Y,
        alive: true,
        colorTop: palette[0],
        colorBottom: palette[1],
        word,
        rotation: (Math.random() - 0.5) * 0.25, // +/- ~14 degrees
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
