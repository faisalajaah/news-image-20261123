// The World Today — Monday 23 November 2026.
// Draws a 1024x1024 newspaper front page as a PNG, pure Node 22 stdlib.
// Writes to $MAKEFUN_OUTPUT_DIR/entry.png (default out/entry.png).
// Deterministic: no clock, no randomness, no network.
import * as fs from "node:fs";
import * as path from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: RGB = [253, 246, 227];
const INK: RGB = [17, 17, 17];
const RED: RGB = [185, 28, 28];
const BLUE: RGB = [30, 58, 95];
const LIGHT_BLUE: RGB = [214, 228, 240];
const SEA: RGB = [23, 68, 110];
const SEA_DARK: RGB = [14, 45, 76];
const GREY: RGB = [110, 110, 105];
const LIGHT_GREY: RGB = [232, 226, 210];
const ORANGE: RGB = [234, 120, 20];
const GOLD: RGB = [201, 162, 39];
const GREEN: RGB = [46, 125, 50];

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPx(i, j, c);
  }
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) {
    for (let x = x0; x <= x1; x++) setPx(x, y + t0, c);
  }
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) {
    for (let y = y0; y <= y1; y++) setPx(x + t0, y, c);
  }
}
// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
    }
  }
}
function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let k = 0; k < t; k++) {
    const rr = r - k;
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      setPx(Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad)), c);
    }
  }
}

// ------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, each a 5-bit mask (bit 4 = leftmost column).
const F: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  a: [0b00000, 0b00000, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111],
  b: [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  c: [0b00000, 0b00000, 0b01110, 0b10000, 0b10000, 0b10001, 0b01110],
  d: [0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111],
  e: [0b00000, 0b00000, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
  f: [0b00110, 0b01001, 0b01000, 0b11110, 0b01000, 0b01000, 0b01000],
  g: [0b00000, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110],
  h: [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001],
  i: [0b00100, 0b00000, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
  j: [0b00010, 0b00000, 0b00110, 0b00010, 0b00010, 0b10010, 0b01100],
  k: [0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010],
  l: [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  m: [0b00000, 0b00000, 0b11010, 0b10101, 0b10101, 0b10101, 0b10101],
  n: [0b00000, 0b00000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001],
  o: [0b00000, 0b00000, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  p: [0b00000, 0b00000, 0b11110, 0b10001, 0b10001, 0b11110, 0b10000],
  q: [0b00000, 0b00000, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001],
  r: [0b00000, 0b00000, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000],
  s: [0b00000, 0b00000, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  t: [0b01000, 0b01000, 0b11100, 0b01000, 0b01000, 0b01001, 0b00110],
  u: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101],
  v: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  w: [0b00000, 0b00000, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  x: [0b00000, 0b00000, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  y: [0b00000, 0b00000, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110],
  z: [0b00000, 0b00000, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ":": [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ";": [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "-": [0, 0, 0, 0b11111, 0, 0, 0],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
  "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  $: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  "=": [0, 0, 0b11111, 0, 0b11111, 0, 0],
  "*": [0, 0b10101, 0b01110, 0b10101, 0, 0, 0],
  "#": [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  "@": [0b01110, 0b10001, 0b10111, 0b10101, 0b10110, 0b10000, 0b01110],
  _: [0, 0, 0, 0, 0, 0, 0b11111],
};

function glyph(ch: string): number[] {
  return F[ch] ?? F["?"];
}
function textW(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}
function drawText(x: number, y: number, s: string, sc: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) {
          rect(cx + col * sc, y + r * sc, sc, sc, c);
        }
      }
    }
    cx += 6 * sc;
  }
}
function drawTextCenter(x0: number, x1: number, y: number, s: string, sc: number, c: RGB): void {
  const w = textW(s, sc);
  drawText(Math.round(x0 + (x1 - x0 - w) / 2), y, s, sc, c);
}
// Greedy word wrap. Returns the lines.
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textW(trial, sc) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
// Draw wrapped paragraph; returns y just below the last line.
function para(x: number, y: number, maxW: number, s: string, sc: number, c: RGB, lh: number): number {
  const lines = wrap(s, maxW, sc);
  for (const ln of lines) drawText(x, y, ln, sc, c), (y += lh);
  return y;
}

// ------------------------------------------------------------ illustrations
function drawLeadArt1(x: number, y: number, w: number, h: number): void {
  // Sea, warship and drone strike off a coast — stylised illustration.
  rect(x, y, w, h, SEA);
  // Sky band.
  rect(x, y, w, 26, LIGHT_BLUE);
  disc(x + w - 52, y + 16, 11, GOLD); // sun
  // Distant coast.
  rect(x, y + 26, w, 8, [120, 140, 120]);
  // Ship hull.
  const hy = y + 62;
  for (let i = 0; i < 150; i++) {
    const t = i / 150;
    const top = hy + Math.round(10 * t * (1 - t) * 0 + 0);
    void top;
    void t;
  }
  rect(x + 60, hy, 190, 16, [70, 76, 82]); // hull
  line(x + 60, hy, x + 44, hy + 16, [70, 76, 82]);
  line(x + 250, hy, x + 266, hy + 16, [70, 76, 82]);
  rect(x + 60, hy + 16, 206, 6, [52, 56, 62]); // keel line
  rect(x + 120, hy - 22, 60, 22, [96, 102, 108]); // superstructure
  line(x + 150, hy - 22, x + 150, hy - 40, [70, 76, 82]); // mast
  line(x + 150, hy - 40, x + 138, hy - 30, [70, 76, 82]);
  rect(x + 96, hy - 12, 8, 12, [52, 56, 62]); // funnel
  // Explosion burst above the ship.
  const ex = x + 300;
  const ey = hy - 34;
  for (let a = 0; a < 12; a++) {
    const rad = (a * Math.PI) / 6;
    const len = a % 2 === 0 ? 26 : 16;
    line(ex, ey, Math.round(ex + len * Math.cos(rad)), Math.round(ey + len * Math.sin(rad)), ORANGE);
    line(ex, ey, Math.round(ex + len * 0.6 * Math.cos(rad + 0.26)), Math.round(ey + len * 0.6 * Math.sin(rad + 0.26)), [255, 200, 60]);
  }
  disc(ex, ey, 9, ORANGE);
  disc(ex, ey, 5, [255, 210, 80]);
  // Drones: small crosses with dotted trails.
  const drones: Array<[number, number]> = [
    [x + 30, y + 52],
    [x + 90, y + 44],
    [x + 340, y + 40],
    [x + 400, y + 58],
  ];
  for (const [dx, dy] of drones) {
    line(dx - 5, dy, dx + 5, dy, [255, 255, 255]);
    line(dx, dy - 5, dx, dy + 5, [255, 255, 255]);
    for (let k = 1; k <= 4; k++) setPx(dx - 8 - k * 4, dy + 1, [255, 255, 255]);
  }
  // Waves.
  for (let wy = hy + 30; wy < y + h - 6; wy += 12) {
    for (let wx = x + 4; wx < x + w - 20; wx += 26) {
      line(wx, wy, wx + 8, wy - 3, [150, 190, 220]);
      line(wx + 8, wy - 3, wx + 16, wy, [150, 190, 220]);
    }
  }
  drawText(x + 8, y + h - 16, "ILLUSTRATION", 1, [255, 255, 255]);
}

function drawLeadArt2(x: number, y: number, w: number, h: number): void {
  // A cracked globe under grey storm clouds — the climate talks fail.
  rect(x, y, w, h, [238, 232, 214]);
  drawText(x + 8, y + 6, "ILLUSTRATION", 1, [90, 90, 86]);
  // Clouds, top right only so they never touch the label.
  for (const [cx, cy, r] of [
    [x + w - 100, y + 14, 15],
    [x + w - 76, y + 10, 19],
    [x + w - 52, y + 16, 13],
  ] as Array<[number, number, number]>) {
    disc(cx, cy, r, [120, 124, 128]);
  }
  // Globe, slightly left of centre.
  const gx = x + Math.round(w / 2) - 46;
  const gy = y + 48;
  const gr = 28;
  disc(gx, gy, gr, [64, 130, 190]);
  // Continents (blobs).
  disc(gx - 12, gy - 8, 8, GREEN);
  disc(gx + 9, gy + 5, 10, GREEN);
  disc(gx + 14, gy - 14, 5, GREEN);
  disc(gx - 5, gy + 14, 6, GREEN);
  ring(gx, gy, gr, BLUE, 2);
  // Crack across the globe.
  line(gx - 22, gy - 19, gx - 7, gy - 3, RED);
  line(gx - 7, gy - 3, gx + 3, gy - 12, RED);
  line(gx + 3, gy - 12, gx + 12, gy + 2, RED);
  line(gx + 12, gy + 2, gx + 22, gy + 16, RED);
  // Broken pact: a torn paper strip under the globe, text at the right.
  const py = y + h - 24;
  rect(x + 30, py, w - 60, 18, [255, 255, 255]);
  line(x + 30, py, x + 42, py + 18, INK);
  line(x + 42, py + 18, x + 54, py, INK);
  line(x + 62, py + 5, x + 130, py + 5, GREY);
  line(x + 62, py + 12, x + 150, py + 12, GREY);
  drawText(x + w - 96, py + 6, "NO DEAL", 1, RED);
}

// ------------------------------------------------------------------ content
const LEAD1_HEAD = "UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA";
const LEAD1_BODY =
  "President Volodymyr Zelenskyy said on Monday that Ukrainian naval drones sank the Russian corvette Merkury off Libya. Seven sea drones struck the ship as it refuelled at Benghazi. Kyiv said a Russian helicopter was destroyed and the cargo ship MV Angara was also hit.";
const LEAD2_HEAD = "COP31 COLLAPSES AS CLIMATE TALKS FAIL";
const LEAD2_BODY =
  "The UN climate summit in Antalya ended on Sunday with no deal, the first COP to fail since Copenhagen in 2009 and the longest ever. On Monday the blame game began: Pacific island nations voiced despair, and Australia's Chris Bowen faced calls to resign. The draft deal dropped all mention of fossil fuels.";

const MIDS: Array<{ head: string; body: string }> = [
  {
    head: "KYIV STRIKES KILL 14 AS TALKS LOOM",
    body: "Russian strikes killed at least 14 people around Kyiv on Monday, Ukraine said, hitting flats in Dymer and a shop in Vyshneve. Moscow said new trilateral talks would be held soon.",
  },
  {
    head: "MARKETS BOUNCE AFTER AI ROUT",
    body: "US futures rebounded on Monday after Friday's AI rout, when the Nasdaq fell 5.3% and Nvidia sank 14% on an SEC probe. China cut margin rules; Taiwan curbed short selling.",
  },
  {
    head: "DEMOCRATS CLINCH 258 HOUSE SEATS",
    body: "Democrats secured 258 House seats after a North Carolina recount confirmed Chuck Hubbard's win, their largest majority in over three decades. The party takes control in January.",
  },
];

const BRIEFS: Array<{ head: string; body: string }> = [
  {
    head: "NATO MEETS OVER POLAND MISSILES",
    body: "NATO met in Brussels after Russian missiles hit Poland. Rutte vowed to defend 'every centimetre' of land.",
  },
  {
    head: "EU UNVEILS NEW RUSSIA SANCTIONS",
    body: "The EU was due to unveil its 22nd Russia sanctions package on Monday, hitting banks and the shadow fleet.",
  },
  {
    head: "IRAN CLAIMS US DRONE DOWNED",
    body: "Iran said it shot down a US MQ-9 drone over the Strait of Hormuz on Monday, days after two tankers hit mines.",
  },
  {
    head: "INDONESIA SEIZES CHEMICAL SHIP",
    body: "Indonesia seized a ship from China with 405 tonnes of sodium perchlorate, used in rocket propellant.",
  },
  {
    head: "DELTA OUTAGE EASES AS TRAVEL STARTS",
    body: "Delta said systems were back to normal after an outage delayed 1,600-plus flights on Sunday.",
  },
  {
    head: "BELGIUM GROUNDS FLIGHTS IN STRIKE",
    body: "Belgian airports shut down on Monday as controllers joined a nationwide strike against austerity cuts.",
  },
];

const ALSO: string[] = [
  "Armenia opens US-backed 'Trump Route'.",
  "Denmark: Russia plotted to kill rapper.",
  "Nepal PM Balen Shah welcomed in Delhi.",
  "S. Korea minister quits in AI exam row.",
  "Riemann hypothesis proof confirmed.",
  "METR: AI outpacing safety testing.",
  "Gold up 2.7% to $3,631; Bitcoin $61,386.",
  "Sensex falls 1,100 points in sell-off.",
  "NFL: Bengals at Commanders tonight.",
];

// ------------------------------------------------------------------- layout
function drawPage(): void {
  fillAll(PAPER);
  const M = 24; // margin
  const R = W - M; // right edge

  // ---- masthead
  drawTextCenter(M, R, 12, "THE WORLD TODAY", 8, INK);
  hline(M, R, 78, RED, 3);
  drawTextCenter(M, R, 88, "MONDAY 23 NOVEMBER 2026", 3, RED);
  hline(M, R, 116, INK, 2);

  // ---- leads
  const leadY = 128;
  const colW = 476;
  const leadXs = [M, 524];
  const arts = [drawLeadArt1, drawLeadArt2];
  const heads = [LEAD1_HEAD, LEAD2_HEAD];
  const bodies = [LEAD1_BODY, LEAD2_BODY];
  for (let i = 0; i < 2; i++) {
    const x = leadXs[i];
    arts[i](x, leadY, colW, 100);
    let y = leadY + 108;
    y = para(x, y, colW, heads[i], 3, INK, 24);
    hline(x, x + colW, y + 2, GREY, 1);
    y = para(x, y + 10, colW, bodies[i], 2, INK, 15);
    void y;
  }
  // vertical divider between leads
  vline(512, leadY, 414, GREY, 1);

  // ---- mid stories
  hline(M, R, 424, INK, 2);
  const midY = 436;
  const midW = 312;
  const midXs = [M, 356, 688];
  for (let i = 0; i < 3; i++) {
    const x = midXs[i];
    let y = para(x, midY, midW, MIDS[i].head, 3, INK, 24);
    hline(x, x + midW, y + 2, GREY, 1);
    para(x, y + 10, midW, MIDS[i].body, 2, INK, 15);
    if (i < 2) vline(x + midW + 10, midY, 600, GREY, 1);
  }

  // ---- briefs: 2 columns x 3 rows, row height measured from the actual
  // wrapped line counts so a long body can never collide with the next
  // row's headline (fixed 72px rows overlapped a 4-line body).
  hline(M, R, 610, INK, 2);
  drawText(M, 620, "IN BRIEF", 2, RED);
  const briefY0 = 642;
  const briefGap = 8;
  const briefXs = [M, 524];
  let briefY = briefY0;
  for (let row = 0; row < 3; row++) {
    let rowH = 0;
    for (let col = 0; col < 2; col++) {
      const b = BRIEFS[row * 2 + col];
      const hLines = wrap(b.head, colW, 2).length;
      const bLines = wrap(b.body, colW, 2).length;
      rowH = Math.max(rowH, hLines * 15 + 4 + bLines * 15);
    }
    for (let col = 0; col < 2; col++) {
      const i = row * 2 + col;
      const x = briefXs[col];
      let y = para(x, briefY, colW, BRIEFS[i].head, 2, INK, 15);
      para(x, y + 4, colW, BRIEFS[i].body, 2, [60, 60, 56], 15);
    }
    briefY += rowH + briefGap;
  }
  vline(512, briefY0, briefY - briefGap, GREY, 1);

  // ---- ALSO strip
  const alsoY = 858;
  hline(M, R, alsoY, INK, 2);
  drawText(M, alsoY + 10, "ALSO TODAY", 2, RED);
  const alsoColW = 476;
  const alsoXs = [M, 524];
  for (let i = 0; i < ALSO.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = alsoXs[col];
    const y = alsoY + 30 + row * 17;
    drawText(x, y, "-", 2, RED);
    drawText(x + 14, y, ALSO[i], 2, INK);
  }

  // ---- footer
  hline(M, R, 982, INK, 2);
  drawTextCenter(M, R, 990, "THE WORLD TODAY  -  MONDAY 23 NOVEMBER 2026", 2, INK);
}

// ---------------------------------------------------------------------- PNG
function crc32(buf: Buffer): number {
  let table = crcTable;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crcTable = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
let crcTable: Uint32Array | null = null;

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(outPath: string): void {
  drawPage();
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Raw scanlines: filter byte 0 + RGB rows.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  const outPath = path.join(outDir, "entry.png");
  writePng(outPath);
  const st = fs.statSync(outPath);
  process.stdout.write(`wrote ${outPath} ${st.size} bytes\n`);
}

main();
