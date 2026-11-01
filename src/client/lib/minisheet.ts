/*
 * Kleines Blatt aus einem Blatt-Code (src/shared/sheet.ts): Endstand eines Bleach-Laufs für den Tagespost.
 * Wie im Duell: Gebiet in der Spielfarbe mit Rand, das Pigment als Tropfen in der Ecke, Schlamm, die Palette.
 * Kein Bild gespeichert, alles aus dem Code gemalt.
 */
import { TEAM_COLORS, type ColorId } from '../../shared/colors';
import { PIGMENTS } from '../../shared/data';
import { readCell, SHEET_COLS, SHEET_ROWS, type SheetCell } from '../../shared/sheet';

/** Fester Zufall je Zahl, damit dasselbe Blatt immer gleich aussieht */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const rgba = (c: readonly number[], a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Ein Fleck mit leicht unruhigem Rand: mehrere durchscheinende Lagen, jede etwas versetzt */
function wash(g: CanvasRenderingContext2D, x: number, y: number, s: number, c: readonly number[], a: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const j = s * 0.06;
    const dx = (hash(seed + k * 3) - 0.5) * j,
      dy = (hash(seed + k * 3 + 1) - 0.5) * j,
      grow = (hash(seed + k * 3 + 2) - 0.5) * j;
    g.fillStyle = rgba(c, a / 2.2);
    g.beginPath();
    g.roundRect(x + dx - grow, y + dy - grow, s + grow * 2, s + grow * 2, s * 0.22);
    g.fill();
  }
}

/** Das Blatt malen. cell: Feldgröße in CSS-Pixeln */
export function drawSheet(c: HTMLCanvasElement, code: string, col: ColorId | undefined, cell: number, dpr = Math.min(2, window.devicePixelRatio || 1)): void {
  const w = SHEET_COLS * cell,
    h = SHEET_ROWS * cell;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Papier mit etwas Korn
  g.fillStyle = '#f6f0e2';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 26; i++) {
    g.fillStyle = `rgba(120,100,70,${0.03 + hash(i + 77) * 0.06})`;
    g.fillRect(hash(i * 2) * w, hash(i * 2 + 1) * h, 1, 1);
  }
  if (cell >= 8) {
    g.strokeStyle = 'rgba(90,80,60,.10)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < SHEET_COLS; x++) (g.moveTo(x * cell + 0.5, 0), g.lineTo(x * cell + 0.5, h));
    for (let y = 1; y < SHEET_ROWS; y++) (g.moveTo(0, y * cell + 0.5), g.lineTo(w, y * cell + 0.5));
    g.stroke();
  }
  const team = (TEAM_COLORS.find((t) => t.k === col) ?? TEAM_COLORS[0]!).rgb;
  const cells: SheetCell[] = Array.from({ length: SHEET_COLS * SHEET_ROWS }, (_, i) => readCell(code[i] ?? '.'));
  const own = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= SHEET_COLS || y >= SHEET_ROWS) return false;
    const k = cells[y * SHEET_COLS + x]!.kind;
    return k === 'paint' || k === 'home';
  };
  for (let y = 0; y < SHEET_ROWS; y++)
    for (let x = 0; x < SHEET_COLS; x++) {
      const i = y * SHEET_COLS + x;
      const cc = cells[i]!;
      const x0 = x * cell,
        y0 = y * cell;
      if (cc.kind === 'paint') {
        wash(g, x0, y0, cell, team, cc.glazed ? 0.85 : 0.5, i * 17);
        // Pigment als Tropfen in der Ecke
        if (cc.pig >= 0 && cell >= 10) {
          g.fillStyle = rgba(PIGMENTS[cc.pig]!.rgb, 0.95);
          g.beginPath();
          g.arc(x0 + cell * 0.76, y0 + cell * 0.26, Math.max(1.4, cell * 0.12), 0, Math.PI * 2);
          g.fill();
        }
      } else if (cc.kind === 'mud') wash(g, x0, y0, cell, [104, 92, 78], 0.55, i * 17);
      else if (cc.kind === 'home') {
        wash(g, x0, y0, cell, team, 0.55, i * 17);
        // Palette: weiße Scheibe mit drei Farbnäpfchen
        const cx = x0 + cell / 2,
          cy = y0 + cell / 2;
        g.fillStyle = '#fffdf6';
        g.beginPath();
        g.ellipse(cx, cy, cell * 0.36, cell * 0.28, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(team, 0.9);
        g.lineWidth = Math.max(1, cell * 0.06);
        g.stroke();
        for (let k = 0; k < 3; k++) {
          g.fillStyle = rgba(PIGMENTS[(k * 3) % PIGMENTS.length]!.rgb, 0.9);
          g.beginPath();
          g.arc(cx - cell * 0.16 + k * cell * 0.16, cy - cell * 0.04, Math.max(0.8, cell * 0.06), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  // Gebietsrand in der Spielfarbe, wie im Duell (bei winzigen Blättern zart, sonst sieht es aus wie ein Labyrinth)
  g.strokeStyle = rgba(team.map((v) => Math.round(v * 0.72)), cell < 8 ? 0.35 : 0.9);
  g.lineWidth = cell < 8 ? 0.6 : Math.max(1, cell / 11);
  g.lineCap = 'round';
  g.beginPath();
  for (let y = 0; y < SHEET_ROWS; y++)
    for (let x = 0; x < SHEET_COLS; x++) {
      if (!own(x, y)) continue;
      const x0 = x * cell,
        y0 = y * cell;
      if (!own(x, y - 1)) (g.moveTo(x0, y0), g.lineTo(x0 + cell, y0));
      if (!own(x, y + 1)) (g.moveTo(x0, y0 + cell), g.lineTo(x0 + cell, y0 + cell));
      if (!own(x - 1, y)) (g.moveTo(x0, y0), g.lineTo(x0, y0 + cell));
      if (!own(x + 1, y)) (g.moveTo(x0 + cell, y0), g.lineTo(x0 + cell, y0 + cell));
    }
  g.stroke();
}
