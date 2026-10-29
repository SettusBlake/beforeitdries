/*
 * Ziehen als kleines Ritual (PixiJS, WebGL): Pinsel ins Glas, der Pinsel malt den Klecks aufs Blatt, die Farbe läuft und trocknet,
 * W100 rollt, erst dann zeigen sich Seltenheit und echtes Papier, zuletzt dreht sich das Blatt zur Karte.
 * Die Würfe kommen von außen (in der App vom Server), hier wird nur inszeniert. Ein Tipp beschleunigt alles.
 */
import { Application, Container, DisplacementFilter, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { PAPER, PIG, type PaperId } from '../../../shared/data';
import { RARITIES, rarityDef, rarityIndex, type Rarity } from '../../../shared/dice';
import type { Face } from '../../../shared/duel/rules';
import type { Monster } from '../../../shared/monster';
import { renderMonster } from '../../renderer/watercolor';
import { iconSvg } from '../icons';
import { sfx } from '../sound';
import { Particles, backdropCanvas, dropTex, edgeGlowCanvas, flakeTex, glowTex, noiseTex, paperCanvas, raysTex, ringTex, sparkTex } from './fx';

export type RevealPull = {
  rarity: Rarity;
  d100: number;
  /** Schutz vor Pech hat gegriffen */
  pity: 'rare' | 'epic' | 'legendary' | 'ten' | null;
  monster: Monster;
  name: string;
  lv: number;
  faces: Face[];
  dup: boolean;
  glaze: number;
};

/** Leuchtfarbe je Seltenheit */
export const GLOW: Record<Rarity, number> = { common: 0xa3acc2, uncommon: 0x4fd08f, rare: 0x58aaff, epic: 0xbd74ff, legendary: 0xffcc4d };
/** Bis zum Wurf malen alle Züge auf dasselbe Papier, damit nichts die Seltenheit verrät */
const PLAIN: PaperId = 'schul';
/** Wie stark nasse Farbe das Blatt tönt, bevor sie trocknet */
const WET = 0.18;
const hex = (s: string) => parseInt(s.slice(1), 16);
const rgbNum = (c: readonly number[]) => (c[0]! << 16) | (c[1]! << 8) | c[2]!;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = {
  lin: (x: number) => x,
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  in: (x: number) => x * x * x,
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  elastic: (x: number) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
function mixColor(a: number, b: number, t: number): number {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t),
    g = lerp((a >> 8) & 255, (b >> 8) & 255, t),
    bl = lerp(a & 255, b & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

type PaintMask = { s: Sprite; tex: Texture; dab: (x: number, y: number, r: number) => void; bloom: (p: number) => void; fill: () => void; flush: () => void };
type Brush = { c: Container; tip: Graphics };
type Tween = { t: number; ms: number; fn: (p: number) => void; e: (x: number) => number; res: () => void };

export class Reveal {
  readonly app = new Application();
  /** Kamera: alles außer dem Hintergrund */
  private world = new Container();
  private bg = new Sprite();
  private back = new Container();
  private mid = new Container();
  private parts = new Particles();
  private front = new Container();
  private flash = new Graphics();
  private tweens: Tween[] = [];
  private loops: ((dt: number) => void)[] = [];
  private shake = { amp: 0, t: 0 };
  private faceCache = new Map<string, Texture>();
  /** Tempo: 1 normal, beim Überspringen schneller */
  speed = 1;
  W = 390;
  H = 760;

  private host: HTMLElement | null = null;
  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.bg, this.world, this.flash);
    this.world.addChild(this.back, this.mid, this.parts.layer, this.front);
    this.app.ticker.add((tk) => this.tick(tk.deltaMS));
    this.layout();
    window.addEventListener('resize', () => this.layout());
  }
  /** Größe neu messen. Solange die Bühne versteckt ist (Größe 0), bleibt alles, wie es war */
  private layout(): void {
    if (!this.host || this.host.clientWidth < 2 || this.host.clientHeight < 2) return;
    this.app.resize();
    const w = this.app.screen.width,
      h = this.app.screen.height;
    if (w === this.W && h === this.H && this.bg.texture !== Texture.EMPTY) return;
    this.W = w;
    this.H = h;
    const old = this.bg.texture;
    this.bg.texture = Texture.from(backdropCanvas(w, h));
    if (old !== Texture.EMPTY) old.destroy(true);
    this.world.pivot.set(w / 2, h / 2);
    this.world.position.set(w / 2, h / 2);
  }
  /** Bühne zeigen: Größe messen, Uhr läuft */
  show(): void {
    this.layout();
    this.app.ticker.start();
  }
  /** Bühne verstecken: abräumen und die Uhr anhalten, damit nichts im Hintergrund rechnet */
  hide(): void {
    this.reset();
    this.app.ticker.stop();
  }

  /* ---------- Zeit ---------- */
  private tick(raw: number): void {
    const dt = Math.min(60, raw) * this.speed;
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const p = clamp01(tw.t / tw.ms);
      tw.fn(tw.e(p));
      if (p >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.res();
      }
    }
    // Eine Schleife, die auf Abgeräumtes zugreift, fliegt raus, statt den ganzen Ablauf anzuhalten
    this.loops = this.loops.filter((l) => {
      try {
        l(dt);
        return true;
      } catch {
        return false;
      }
    });
    this.parts.update(dt);
    // Wackeln
    if (this.shake.amp > 0.1) {
      this.shake.t += dt;
      const a = this.shake.amp * Math.exp(-this.shake.t / 160);
      this.world.position.set(this.W / 2 + (Math.random() - 0.5) * a * 2, this.H / 2 + (Math.random() - 0.5) * a * 2);
      if (a < 0.2) this.shake.amp = 0;
    } else this.world.position.set(this.W / 2, this.H / 2);
  }
  private tween(ms: number, fn: (p: number) => void, e: (x: number) => number = ease.lin): Promise<void> {
    return new Promise((res) => this.tweens.push({ t: 0, ms, fn, e, res }));
  }
  private wait(ms: number): Promise<void> {
    return this.tween(ms, () => undefined);
  }
  private quake(amp: number): void {
    this.shake = { amp: Math.max(this.shake.amp, amp), t: 0 };
  }
  private whiteFlash(alpha: number, ms: number, color = 0xffffff): void {
    this.flash.clear().rect(0, 0, this.W, this.H).fill({ color });
    this.flash.alpha = alpha;
    void this.tween(ms, (p) => (this.flash.alpha = alpha * (1 - p)), ease.out);
  }
  /** Alles abräumen für den nächsten Zug */
  reset(): void {
    for (const tw of this.tweens) tw.res();
    this.tweens = [];
    this.loops = [];
    this.parts.clear();
    for (const c of [this.back, this.mid, this.front]) c.removeChildren().forEach((x) => x.destroy({ children: true }));
    this.world.scale.set(1);
    this.flash.alpha = 0;
    this.speed = 1;
  }

  /* ---------- Bausteine ---------- */
  private monsterTex(m: Monster, px: number): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    renderMonster(c, m, px, { dpr: 1 });
    return Texture.from(c);
  }
  private faceTex(f: Face): Promise<Texture> {
    const key = `${f.k}${f.n}`;
    const hit = this.faceCache.get(key);
    if (hit) return Promise.resolve(hit);
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 96;
        const x = c.getContext('2d')!;
        x.fillStyle = '#fffdf8';
        x.strokeStyle = 'rgba(60,50,40,.25)';
        x.lineWidth = 3;
        x.beginPath();
        x.roundRect(3, 3, 90, 90, 16);
        x.fill();
        x.stroke();
        x.drawImage(img, 14, 14, 68, 68);
        const t = Texture.from(c);
        this.faceCache.set(key, t);
        res(t);
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(f, 68).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    });
  }
  private burstRing(x: number, y: number, tint: number, size: number, ms = 700, flat = 1): void {
    const s = new Sprite(ringTex());
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = tint;
    s.blendMode = 'add';
    this.front.addChild(s);
    void this.tween(
      ms,
      (p) => {
        s.scale.set((0.1 + p * size) / 1, ((0.1 + p * size) / 1) * flat);
        s.alpha = 1 - p;
      },
      ease.out,
    ).then(() => s.destroy());
  }
  private sparkles(x: number, y: number, tint: number, n: number, spread: number): void {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2,
        v = 60 + Math.random() * spread;
      this.parts.spawn({ tex: sparkTex(), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, drag: 0.04, life: 700 + Math.random() * 600, tint, add: true, scale: 0.25 + Math.random() * 0.35, scaleEnd: 0.05, spin: (Math.random() - 0.5) * 6 });
    }
  }
  private droplets(x: number, y: number, tint: number, n: number, speed: number): void {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2,
        v = speed * (0.4 + Math.random());
      this.parts.spawn({ tex: dropTex(), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.5, g: 900, drag: 0.01, life: 600 + Math.random() * 400, tint, scale: 0.08 + Math.random() * 0.12, scaleEnd: 0.03 });
    }
  }

  /** Glas mit Farbe, Leuchten dahinter */
  private makeJar(): { c: Container; liquid: Graphics; glow: Sprite; setColor: (n: number) => void } {
    const c = new Container();
    const glow = new Sprite(glowTex());
    glow.anchor.set(0.5);
    glow.scale.set(1.3);
    glow.blendMode = 'add';
    glow.alpha = 0.45;
    const liquid = new Graphics().roundRect(-40, -6, 80, 52, 14).fill({ color: 0xffffff });
    const surface = new Graphics().ellipse(0, -6, 40, 7).fill({ color: 0xffffff, alpha: 0.5 });
    const glass = new Graphics()
      .roundRect(-46, -46, 92, 98, 20)
      .fill({ color: 0xffffff, alpha: 0.07 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.4 })
      .roundRect(-38, -58, 76, 16, 6)
      .fill({ color: 0xffffff, alpha: 0.08 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
    const shine = new Graphics().roundRect(-34, -34, 7, 60, 4).fill({ color: 0xffffff, alpha: 0.28 });
    c.addChild(glow, liquid, surface, glass, shine);
    const setColor = (n: number) => {
      liquid.tint = n;
      surface.tint = mixColor(n, 0xffffff, 0.4);
      glow.tint = n;
    };
    return { c, liquid, glow, setColor };
  }
  /** Pinsel: Stiel, Zwinge, Haare mit Farbspitze */
  private makeBrush(): Brush {
    const c = new Container();
    const handle = new Graphics().roundRect(-6, -190, 12, 150, 6).fill({ color: 0x7a4a26 }).roundRect(-6, -190, 12, 30, 6).fill({ color: 0x1d2130 });
    const ferrule = new Graphics().roundRect(-7.5, -44, 15, 22, 3).fill({ color: 0xc8c6cc }).rect(-7.5, -38, 15, 2).fill({ color: 0x8d8a92 });
    const hair = new Graphics().moveTo(-7, -22).bezierCurveTo(-10, -2, -4, 14, 0, 26).bezierCurveTo(4, 14, 10, -2, 7, -22).closePath().fill({ color: 0x3a2b22 });
    const tip = new Graphics().moveTo(-6, 4).bezierCurveTo(-5, 14, -2, 20, 0, 26).bezierCurveTo(2, 20, 5, 14, 6, 4).closePath().fill({ color: 0xffffff });
    tip.alpha = 0;
    c.addChild(handle, ferrule, hair, tip);
    return { c, tip };
  }
  /** Malmaske: Pinseltupfer und Ineinanderlaufen decken den Klecks auf. Koordinaten in Blattpixeln, Mitte 0,0 */
  private makePaintMask(size: number): PaintMask {
    const N = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const x = cv.getContext('2d')!;
    const tex = Texture.from(cv);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = size;
    const k = N / size;
    const soft = (px: number, py: number, r: number, a: number) => {
      if (r <= 0) return;
      const g = x.createRadialGradient(px, py, r * 0.45, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    };
    const dab = (px: number, py: number, r: number) => {
      const cx = (px + size / 2) * k,
        cy = (py + size / 2) * k,
        rr = r * k;
      soft(cx, cy, rr, 0.9);
      // Borsten: kleine Tupfer am Rand machen die Bahn ausgefranst
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2,
          d = rr * (0.6 + Math.random() * 0.5);
        soft(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr * (0.2 + Math.random() * 0.2), 0.7);
      }
    };
    const blobs = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + Math.random() * 0.6, d: 0.15 + Math.random() * 0.25, r: 0.18 + Math.random() * 0.15 }));
    const bloom = (p: number) => {
      const c = N / 2,
        e = ease.out(p);
      soft(c, c, N * 0.75 * e, 0.5);
      for (const b of blobs) soft(c + Math.cos(b.a) * b.d * N, c + Math.sin(b.a) * b.d * N, b.r * N * e, 0.45);
    };
    const fill = () => {
      x.fillStyle = 'white';
      x.fillRect(0, 0, N, N);
      tex.source.update();
    };
    return { s, tex, dab, bloom, fill, flush: () => tex.source.update() };
  }

  /** Stellt den Pinsel so, dass seine Spitze genau auf (x, y) sitzt */
  private tipAt(b: Container, x: number, y: number, rot: number, scale: number): void {
    b.rotation = rot;
    b.position.set(x + 26 * scale * Math.sin(rot), y - 26 * scale * Math.cos(rot));
  }
  /** Der Pinsel malt in Bahnen hin und her über ein Blatt (Mitte cx, cy, Größe S) und deckt dabei die Maske auf */
  private async paintStrokes(o: { cx: number; cy: number; S: number; mask: PaintMask; brush: Brush; color: number; rows: number; ms: number; scale: number; sound: boolean }): Promise<void> {
    const { S, mask } = o;
    const b = o.brush.c;
    const r = S * (o.rows >= 4 ? 0.14 : 0.24);
    for (let k = 0; k < o.rows; k++) {
      const dir = k % 2 ? -1 : 1;
      const y0 = o.rows === 1 ? 0 : -0.33 * S + (k * 0.66 * S) / (o.rows - 1);
      const y1 = y0 + (Math.random() - 0.5) * 0.08 * S;
      const x0 = -0.4 * S * dir,
        x1 = 0.4 * S * dir;
      const bend = (Math.random() - 0.5) * 0.14 * S;
      const rot = dir * 0.42;
      // Zum Anfang der Bahn, dabei leicht angehoben
      const fx = b.x,
        fy = b.y,
        fr = b.rotation;
      const tx = o.cx + x0 + 26 * o.scale * Math.sin(rot),
        ty = o.cy + y0 - 26 * o.scale * Math.cos(rot);
      await this.tween(o.ms * (k ? 0.4 : 0.8), (q) => {
        b.x = lerp(fx, tx, q);
        b.y = lerp(fy, ty, q) - 18 * o.scale * Math.sin(q * Math.PI);
        b.rotation = lerp(fr, rot, q);
      }, ease.inOut);
      if (o.sound) sfx.stroke();
      let last: [number, number] | null = null;
      await this.tween(o.ms, (q) => {
        const lx = lerp(x0, x1, q),
          ly = lerp(y0, y1, q) + bend * 4 * q * (1 - q);
        this.tipAt(b, o.cx + lx, o.cy + ly, rot - dir * 0.12 * Math.sin(q * Math.PI), o.scale);
        // Druck: am Anfang und Ende der Bahn etwas weniger Farbe
        const pr = r * (0.7 + 0.4 * Math.sin(Math.PI * Math.min(1, q * 1.4)));
        if (last) {
          const d = Math.hypot(lx - last[0], ly - last[1]);
          const n = Math.max(1, Math.ceil(d / (pr * 0.3)));
          for (let i = 1; i <= n; i++) mask.dab(lerp(last[0], lx, i / n), lerp(last[1], ly, i / n), pr);
        } else mask.dab(lx, ly, pr);
        last = [lx, ly];
        mask.flush();
        if (Math.random() < 0.1) this.droplets(o.cx + lx, o.cy + ly, o.color, 1, 110 * o.scale);
      }, ease.inOut);
    }
  }

  /* ---------- Ein Zug ---------- */
  private geometry() {
    const S = Math.min(this.W * 0.74, this.H * 0.42, 340);
    return { S, cx: this.W / 2, cy: this.H * 0.36, jarY: this.H * 0.86 };
  }

  /**
   * Der ganze Ablauf eines Zugs. Bis der W100 liegt, sieht jeder Zug gleich aus: gleiches Papier, Farbe nur vom Pigment.
   * Erst danach zeigen sich Seltenheit und echtes Papier. Nach dem Zehnerzug ohne Malen und ohne Rattern
   */
  async single(p: RevealPull, o: { paint?: boolean; roll?: boolean } = {}): Promise<void> {
    const paint = o.paint ?? true,
      roll = o.roll ?? true;
    this.reset();
    const ri = rarityIndex(p.rarity);
    const g = this.geometry();
    const tint = GLOW[p.rarity];
    const pig = rgbNum(PIG[p.monster.main].rgb);
    const faceTexP = Promise.all(p.faces.map((f) => this.faceTex(f)));
    const plainTex = this.monsterTex({ ...p.monster, paper: PLAIN }, 512);

    // Hinten: Strahlen und Hof (erst bei der Seltenheit sichtbar)
    const rays = new Sprite(raysTex());
    rays.anchor.set(0.5);
    rays.position.set(g.cx, g.cy);
    rays.scale.set((g.S * 2.6) / 512);
    rays.blendMode = 'add';
    rays.alpha = 0;
    const halo = new Sprite(glowTex());
    halo.anchor.set(0.5);
    halo.position.set(g.cx, g.cy);
    halo.scale.set((g.S * 2.4) / 256);
    halo.blendMode = 'add';
    halo.alpha = 0;
    // Leuchtender Rand, vorab weichgezeichnet statt mit einem Filter in jedem Bild
    const edge = new Sprite(Texture.from(edgeGlowCanvas(Math.round(g.S))));
    edge.anchor.set(0.5);
    edge.position.set(g.cx, g.cy);
    edge.blendMode = 'add';
    edge.alpha = 0;
    this.back.addChild(halo, rays, edge);
    let rayOn = false;
    this.loops.push((dt) => {
      rays.rotation += dt * 0.00012 * (rayOn ? 1 : 0.3);
    });

    // Das Blatt: neutrales Papier, darüber der Klecks hinter der Malmaske, leicht verzerrt solange nass
    const sheet = new Container();
    sheet.position.set(g.cx, g.cy);
    const paper = new Sprite(Texture.from(paperCanvas(Math.round(g.S), Math.round(g.S), PAPER[PLAIN].tone, false)));
    paper.anchor.set(0.5);
    const ink = new Container();
    const mon = new Sprite(plainTex);
    mon.anchor.set(0.5);
    mon.width = mon.height = g.S;
    const mask = this.makePaintMask(g.S);
    ink.addChild(mon, mask.s);
    mon.mask = mask.s;
    // Nasse Farbe: gemalte Stellen sind dunkler, bis sie trocknen
    const wet = new Sprite(mask.tex);
    wet.anchor.set(0.5);
    wet.width = wet.height = g.S;
    wet.tint = pig;
    wet.blendMode = 'multiply';
    wet.alpha = 0;
    const disp = new Sprite(noiseTex());
    disp.texture.source.addressMode = 'repeat';
    disp.anchor.set(0.5);
    disp.scale.set(2);
    disp.renderable = false;
    const dfilter = new DisplacementFilter({ sprite: disp, scale: 0 });
    ink.filters = [dfilter];
    sheet.addChild(paper, ink, wet, disp);
    this.mid.addChild(sheet);
    this.loops.push((dt) => {
      if (disp.destroyed) return;
      disp.x += dt * 0.03;
      disp.y += dt * 0.017;
    });

    if (paint) {
      sheet.alpha = 0;
      sheet.scale.set(0.92);
      void this.tween(500, (q) => {
        sheet.alpha = q;
        sheet.scale.set(0.92 + 0.08 * q);
      }, ease.out);
      // 1. Eintauchen: das Glas zeigt nur das Pigment, nichts von der Seltenheit
      const jar = this.makeJar();
      jar.c.position.set(g.cx, g.jarY + 60);
      jar.c.alpha = 0;
      jar.setColor(pig);
      const brush = this.makeBrush();
      brush.c.position.set(g.cx + 90, g.jarY - 260);
      brush.c.rotation = -0.5;
      this.mid.addChild(jar.c);
      this.front.addChild(brush.c);
      await this.tween(450, (q) => {
        jar.c.alpha = q;
        jar.c.y = g.jarY + 60 * (1 - q);
      }, ease.out);
      await this.tween(650, (q) => {
        brush.c.x = lerp(g.cx + 90, g.cx + 6, q);
        brush.c.y = lerp(g.jarY - 260, g.jarY - 8, q);
        brush.c.rotation = lerp(-0.5, -0.12, q);
      }, ease.inOut);
      sfx.dip();
      for (let k = 0; k < 3; k++) window.setTimeout(() => this.burstRing(g.cx, g.jarY - 6, pig, 0.5, 600, 0.25), (k * 140) / this.speed);
      brush.tip.tint = pig;
      void this.tween(300, (q) => (brush.tip.alpha = q));
      await this.tween(520, (q) => (jar.glow.alpha = 0.45 + 0.35 * Math.sin(q * Math.PI)));
      // 2. Der Pinsel malt den Klecks in Bahnen aufs Blatt
      sfx.lift();
      void this.tween(600, (q) => (jar.c.alpha = 1 - q * 0.8));
      wet.alpha = WET;
      dfilter.scale.x = dfilter.scale.y = 10;
      await this.paintStrokes({ cx: g.cx, cy: g.cy, S: g.S, mask, brush, color: pig, rows: 5, ms: 420, scale: 1, sound: true });
      // 3. Der Pinsel geht, die Farbe läuft ineinander und trocknet
      const bx = brush.c.x,
        by0 = brush.c.y;
      void this.tween(450, (q) => {
        brush.c.x = bx + 120 * q;
        brush.c.y = by0 - 220 * q;
        brush.c.alpha = 1 - q;
      }, ease.in);
      sfx.swell(0);
      await this.tween(1000, (q) => {
        mask.bloom(q);
        mask.flush();
        dfilter.scale.x = dfilter.scale.y = 10 - 6 * q;
      }, ease.out);
      mask.fill();
      await this.tween(700, (q) => {
        wet.alpha = WET * (1 - q);
        dfilter.scale.x = dfilter.scale.y = 4 * (1 - q);
      }, ease.out);
      jar.c.destroy({ children: true });
      brush.c.destroy({ children: true });
    } else {
      mask.fill();
      sheet.scale.set(0.6);
      sheet.alpha = 0;
      await this.tween(500, (q) => {
        sheet.alpha = q;
        sheet.scale.set(0.6 + 0.4 * q);
      }, ease.back);
    }
    ink.filters = [];
    mon.mask = null;
    mask.s.visible = false;
    wet.visible = false;
    // Der echte Klecks auf seinem Papier, noch unsichtbar (einmal kurz rechnen, solange der Wurf noch nicht da ist)
    const realTex = this.monsterTex(p.monster, 512);

    // 6. Der Wurf: W100 rollt, die Leiste füllt sich
    const numY = g.cy + g.S / 2 + 62;
    const label = new Text({ text: 'd100', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: '700', fill: 0xbdb3a6, letterSpacing: 3 } });
    label.anchor.set(0.5);
    label.position.set(g.cx, numY - 44);
    const num = new Text({ text: roll ? '00' : String(p.d100), style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 64, fontWeight: '800', fill: 0xfdf8ee, stroke: { color: 0x15111a, width: 6 } } });
    num.anchor.set(0.5);
    num.position.set(g.cx, numY);
    const bw = Math.min(this.W * 0.78, 320),
      by = numY + 52;
    const band = new Graphics();
    let x = g.cx - bw / 2;
    for (const r of RARITIES) {
      const w = ((r.to - r.from + 1) / 100) * bw;
      band.roundRect(x, by, Math.max(3, w - 1.5), 10, 3).fill({ color: hex(r.col) });
      x += w;
    }
    const marker = new Graphics().moveTo(0, -4).lineTo(-8, -16).lineTo(8, -16).closePath().fill({ color: 0xfdf8ee }).rect(-1.5, -4, 3, 20).fill({ color: 0xfdf8ee });
    marker.position.set(g.cx - bw / 2, by);
    const rlabel = new Text({ text: rarityDef(p.rarity).label, style: { fontFamily: 'Young Serif, Georgia, serif', fontSize: 40, fill: tint, dropShadow: { color: tint, blur: 18, distance: 0, alpha: 0.8 } } });
    rlabel.anchor.set(0.5);
    rlabel.position.set(g.cx, by + 50);
    rlabel.alpha = 0;
    const rollUi = new Container();
    rollUi.addChild(label, num, band, marker, rlabel);
    rollUi.alpha = 0;
    this.front.addChild(rollUi);
    await this.tween(300, (q) => (rollUi.alpha = q));
    const steps = roll ? 18 : 0;
    for (let k = 0; k < steps; k++) {
      const v = 1 + Math.floor(Math.random() * 100);
      num.text = String(v).padStart(2, '0');
      num.rotation = (Math.random() - 0.5) * 0.25;
      sfx.tick(k);
      const target = g.cx - bw / 2 + (v / 100) * bw;
      await this.tween(45 + k * 7, (q) => {
        num.scale.set(1.18 - 0.18 * q);
        marker.x = lerp(marker.x, target, q * 0.5);
      });
    }
    num.text = String(p.d100);
    num.rotation = 0;
    sfx.land();
    this.quake(6);
    this.burstRing(g.cx, numY, 0xfdf8ee, 1.1, 500);
    const mt = g.cx - bw / 2 + ((p.d100 - 0.5) / 100) * bw;
    const m0 = marker.x;
    await this.tween(420, (q) => {
      num.scale.set(1.7 - 0.7 * q);
      marker.x = lerp(m0, mt, q);
    }, ease.elastic);

    // 7. Erst jetzt zeigt sich das echte Papier: ein Lichtstreif fährt über das Blatt und tauscht es aus
    const real = new Container();
    const rp = new Sprite(Texture.from(paperCanvas(Math.round(g.S), Math.round(g.S), PAPER[p.monster.paper].tone, PAPER[p.monster.paper].deckle)));
    rp.anchor.set(0.5);
    const rm = new Sprite(realTex);
    rm.anchor.set(0.5);
    rm.width = rm.height = g.S;
    real.addChild(rp, rm);
    const wipe = new Graphics();
    real.mask = wipe;
    const streak = new Sprite(glowTex());
    streak.anchor.set(0.5);
    streak.blendMode = 'add';
    streak.tint = tint;
    streak.scale.set((g.S * 0.5) / 256, (g.S * 1.5) / 256);
    streak.alpha = 0;
    sheet.addChild(real, wipe, streak);
    sfx.wipe();
    void this.tween(650, (q) => {
      const wx = lerp(-g.S / 2 - 30, g.S / 2 + 30, q);
      wipe.clear().rect(-g.S / 2 - 20, -g.S / 2 - 20, Math.max(0.1, wx + g.S / 2 + 20), g.S + 40).fill({ color: 0xffffff });
      streak.x = wx;
      streak.alpha = Math.sin(q * Math.PI) * 0.9;
    }, ease.inOut).then(() => {
      if (real.destroyed) return;
      real.mask = null;
      wipe.destroy();
      streak.destroy();
      paper.visible = ink.visible = false;
    });
    // Die Seltenheit: Strahlen, Hof, Funkeln, bei Legendary Blattgold
    sfx.reveal(ri);
    if (ri >= 3) sfx.shimmer();
    rays.tint = tint;
    halo.tint = tint;
    edge.tint = tint;
    rayOn = ri >= 2;
    if (ri >= 3) this.whiteFlash(ri === 4 ? 0.9 : 0.45, ri === 4 ? 900 : 500, ri === 4 ? 0xfff2c4 : 0xffffff);
    if (ri >= 2) this.quake(ri * 3);
    this.sparkles(g.cx, g.cy, tint, 10 + ri * 12, 120 + ri * 60);
    void this.tween(700, (q) => {
      rays.alpha = (ri >= 2 ? 0.25 + ri * 0.12 : 0.06) * q;
      halo.alpha = (0.12 + ri * 0.13) * q;
      edge.alpha = (ri >= 1 ? 0.35 + ri * 0.12 : 0.15) * q;
      rlabel.alpha = q;
      rlabel.scale.set(0.6 + 0.4 * ease.back(q));
    }, ease.out);
    if (ri >= 3) {
      this.loops.push(() => {
        if (Math.random() < (ri === 4 ? 0.5 : 0.25)) this.parts.spawn({ tex: sparkTex(), x: g.cx + (Math.random() - 0.5) * g.S * 1.4, y: g.cy + g.S * 0.5, vy: -40 - Math.random() * 60, vx: (Math.random() - 0.5) * 20, life: 1600, tint, add: true, scale: 0.2 + Math.random() * 0.2, scaleEnd: 0.02 });
      });
    }
    // Blattgold regnet, sobald die Karte liegt nur noch leicht
    let flakes = 0.6;
    if (ri === 4) {
      this.loops.push(() => {
        if (Math.random() < flakes) this.parts.spawn({ tex: flakeTex(), x: Math.random() * this.W, y: -20, vy: 80 + Math.random() * 90, vx: (Math.random() - 0.5) * 40, g: 10, life: 4200, tint: Math.random() < 0.5 ? 0xffd66b : 0xe0a93a, scale: 0.35 + Math.random() * 0.4, spin: (Math.random() - 0.5) * 4, flip: 3 + Math.random() * 6, rot: Math.random() * 6 });
      });
    }
    this.loops.push((dt) => {
      halo.scale.set(((g.S * 2.4) / 256) * (1 + 0.04 * Math.sin(performance.now() / 300)));
      void dt;
    });
    // Schutz vor Pech: ein Siegel wird aufgestempelt
    if (p.pity) {
      await this.wait(300);
      const seal = this.makeSeal(p.pity === 'ten' ? 'TEN DIPS' : 'SHIELD', p.pity === 'ten' ? 'rare or better' : `${rarityDef(p.pity).label} guaranteed`);
      seal.position.set(g.cx + g.S / 2 - 14, g.cy - g.S / 2 + 14);
      seal.scale.set(3);
      seal.alpha = 0;
      this.front.addChild(seal);
      await this.tween(260, (q) => {
        seal.scale.set(3 - 2 * q);
        seal.alpha = q;
      }, ease.in);
      sfx.stamp();
      this.quake(7);
      this.droplets(seal.x, seal.y, 0xa33a3a, 10, 160);
      // Der Zeiger rutscht in den Bereich, den das Siegel garantiert
      const zone = rarityDef(p.rarity);
      const zx = g.cx - bw / 2 + (((zone.from + zone.to) / 2 - 0.5) / 100) * bw;
      const m1 = marker.x;
      void this.tween(600, (q) => (marker.x = lerp(m1, zx, q)), ease.back);
    }
    await this.wait(1100);

    // 8. Die Karte: das Blatt dreht sich um, das Netz klappt auf, Stempel drauf
    const faces = await faceTexP;
    flakes = 0.1;
    void this.tween(300, (q) => (rollUi.alpha = 1 - q));
    sfx.cardFlip();
    await this.tween(260, (q) => (sheet.scale.x = 1 - q), ease.in);
    const card = this.makeCard(p, realTex, g.S, faces);
    card.c.position.set(g.cx, g.cy + 40);
    sheet.destroy({ children: true });
    this.mid.addChild(card.c);
    card.c.scale.x = 0;
    void this.tween(300, (q) => {
      rays.y = halo.y = edge.y = g.cy + 40 * q;
    }, ease.out);
    await this.tween(360, (q) => (card.c.scale.x = q), ease.back);
    for (const [k, f] of card.faces.entries()) {
      sfx.tick(k);
      void this.tween(260, (q) => f.scale.set(q * f.userScale), ease.back);
      await this.wait(90);
    }
    await this.wait(200);
    const stamp = this.makeStamp(p.dup ? `+${p.glaze} glaze` : 'NEW!', p.dup ? 0x2b6fa3 : 0xc0392b);
    stamp.position.set(g.cx + g.S * 0.28, g.cy - g.S * 0.32 + 40);
    stamp.scale.set(3);
    stamp.alpha = 0;
    this.front.addChild(stamp);
    await this.tween(220, (q) => {
      stamp.scale.set(3 - 2 * q);
      stamp.alpha = q;
    }, ease.in);
    sfx.stamp();
    this.quake(8);
    this.droplets(stamp.x, stamp.y, p.dup ? 0x2b6fa3 : 0xc0392b, 12, 200);
    await this.wait(300);
  }

  private makeSeal(top: string, bottom: string): Container {
    const c = new Container();
    const disc = new Graphics().circle(0, 0, 38).fill({ color: 0x9c2f2f }).circle(0, 0, 31).stroke({ width: 2, color: 0xf0c9a0, alpha: 0.8 });
    const t1 = new Text({ text: top, style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: '800', fill: 0xf7e6cf, letterSpacing: 1 } });
    t1.anchor.set(0.5);
    t1.y = -6;
    const t2 = new Text({ text: bottom, style: { fontFamily: 'Figtree, sans-serif', fontSize: 8.5, fontWeight: '700', fill: 0xf7e6cf, wordWrap: true, wordWrapWidth: 56, align: 'center' } });
    t2.anchor.set(0.5);
    t2.y = 10;
    c.addChild(disc, t1, t2);
    c.rotation = 0.22;
    return c;
  }
  private makeStamp(text: string, color: number): Container {
    const c = new Container();
    const t = new Text({ text, style: { fontFamily: 'Figtree, sans-serif', fontSize: 26, fontWeight: '900', fill: color, letterSpacing: 2 } });
    t.anchor.set(0.5);
    // Papierfarbener Grund, damit der Stempel auch auf gleichfarbigen Klecksen lesbar bleibt
    const box = new Graphics()
      .roundRect(-t.width / 2 - 12, -t.height / 2 - 6, t.width + 24, t.height + 12, 8)
      .fill({ color: 0xfbf8f1, alpha: 0.88 })
      .stroke({ width: 4, color });
    c.addChild(box, t);
    c.rotation = -0.2;
    c.alpha = 0.92;
    return c;
  }
  /** Die Würfelkarte: Rahmen in der Seltenheit, Klecks, Name, Stufe und die sechs Seiten */
  private makeCard(p: RevealPull, mtex: Texture, S: number, faceTex: Texture[]): { c: Container; faces: (Sprite & { userScale: number })[] } {
    const c = new Container();
    const col = hex(rarityDef(p.rarity).col);
    const w = S + 24,
      h = S + 132;
    const frame = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, 16)
      .fill({ color: 0xfbf8f1 })
      .stroke({ width: p.rarity === 'common' ? 3 : 6, color: p.rarity === 'legendary' ? 0xd8a032 : col });
    if (p.rarity === 'legendary') frame.roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 12).stroke({ width: 1.5, color: 0xf3d77a });
    const art = new Sprite(mtex);
    art.anchor.set(0.5);
    art.width = art.height = S - 8;
    art.y = -h / 2 + 12 + (S - 8) / 2;
    const name = new Text({ text: p.name, style: { fontFamily: 'Figtree, sans-serif', fontSize: 20, fontWeight: '800', fill: 0x1d2130 } });
    name.anchor.set(0.5, 0);
    name.y = art.y + (S - 8) / 2 + 8;
    const sub = new Text({ text: `${'★'.repeat(p.lv)} Level ${p.lv} · ${rarityDef(p.rarity).label} · ${PAPER[p.monster.paper].n}`, style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: '700', fill: col } });
    sub.anchor.set(0.5, 0);
    sub.y = name.y + 28;
    c.addChild(frame, art, name, sub);
    const fs = Math.min(40, (w - 40) / 6 - 4);
    const faces = faceTex.map((t, k) => {
      const s = new Sprite(t) as Sprite & { userScale: number };
      s.anchor.set(0.5);
      s.userScale = fs / 96;
      s.scale.set(0);
      s.position.set(-((fs + 5) * 5) / 2 + k * (fs + 5), sub.y + 34);
      c.addChild(s);
      return s;
    });
    return { c, faces };
  }

  /* ---------- Zehnerzug ---------- */
  /** Ein Pinsel malt zehn Blätter, dann landen zehn W100 nacheinander und erst dann zeigt sich die Seltenheit. Der seltenste kommt groß */
  async ten(ps: RevealPull[]): Promise<RevealPull> {
    this.reset();
    const cols = 2,
      rows = 5;
    const top = 64,
      bottom = this.H * 0.92;
    const s = Math.min((this.W - 48) / cols - 18, (bottom - top) / rows - 14);
    const gx = (this.W - (cols * s + (cols - 1) * 18)) / 2;
    const cells = ps.map((_, k) => ({ x: gx + (k % cols) * (s + 18) + s / 2, y: top + Math.floor(k / cols) * (s + 14) + s / 2 }));
    const minis = ps.map((p, k) => {
      const c = new Container();
      c.position.set(cells[k]!.x, cells[k]!.y);
      const ri = rarityIndex(p.rarity);
      const glow = new Sprite(glowTex());
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = GLOW[p.rarity];
      glow.scale.set((s * (ri >= 2 ? 2.6 : 2)) / 256);
      glow.alpha = 0;
      // Rahmen in der Farbe der Seltenheit, damit man sie auch klein sofort erkennt
      const frame = new Graphics().roundRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8, 7).stroke({ width: ri >= 2 ? 4 : 2.5, color: GLOW[p.rarity] });
      frame.alpha = 0;
      const paper = new Sprite(Texture.from(paperCanvas(Math.round(s), Math.round(s), PAPER[PLAIN].tone, false)));
      paper.anchor.set(0.5);
      const mon = new Sprite(this.monsterTex({ ...p.monster, paper: PLAIN }, 180));
      mon.anchor.set(0.5);
      mon.width = mon.height = s;
      const mask = this.makePaintMask(s);
      mon.mask = mask.s;
      const wet = new Sprite(mask.tex);
      wet.anchor.set(0.5);
      wet.width = wet.height = s;
      wet.tint = rgbNum(PIG[p.monster.main].rgb);
      wet.blendMode = 'multiply';
      wet.alpha = WET;
      // Kleines Schild für den W100
      const num = new Text({ text: '··', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: '800', fill: 0xfdf8ee } });
      num.anchor.set(0.5);
      const tag = new Container();
      tag.addChild(new Graphics().roundRect(-25, -12, 50, 24, 8).fill({ color: 0x15111a, alpha: 0.85 }), num);
      tag.position.set(0, s / 2 - 6);
      tag.alpha = 0;
      c.addChild(glow, frame, paper, mon, mask.s, wet, tag);
      c.alpha = 0;
      this.mid.addChild(c);
      return { c, glow, frame, mask, wet, tag, num, p, landed: false };
    });
    await this.tween(400, (q) => minis.forEach((m) => (m.c.alpha = 0.6 * q)));

    // Ein Pinsel zieht von Blatt zu Blatt, jedes Mal mit dem Pigment des nächsten Kleckses
    const brush = this.makeBrush();
    brush.c.scale.set(0.5);
    brush.tip.alpha = 1;
    brush.c.position.set(this.W + 40, top - 40);
    this.front.addChild(brush.c);
    for (const [k, m] of minis.entries()) {
      const cell = cells[k]!;
      const pig = rgbNum(PIG[m.p.monster.main].rgb);
      brush.tip.tint = pig;
      void this.tween(200, (q) => (m.c.alpha = 0.6 + 0.4 * q));
      await this.paintStrokes({ cx: cell.x, cy: cell.y, S: s, mask: m.mask, brush, color: pig, rows: 2, ms: 170, scale: 0.5, sound: true });
      // Die Farbe läuft ineinander und trocknet, während der Pinsel weiterzieht
      void this.tween(450, (q) => {
        m.mask.bloom(q);
        m.mask.flush();
      }, ease.out).then(() => {
        if (m.c.destroyed) return;
        m.mask.fill();
        return this.tween(500, (q) => (m.wet.alpha = WET * (1 - q)));
      });
    }
    const bx = brush.c.x,
      by = brush.c.y;
    await this.tween(400, (q) => {
      brush.c.x = bx + 160 * q;
      brush.c.y = by - 220 * q;
      brush.c.alpha = 1 - q;
    }, ease.in);
    brush.c.destroy({ children: true });
    await this.wait(400);

    // Zehn W100 rattern und landen nacheinander. Erst jetzt zeigt sich die Seltenheit, mit echtem Papier
    void this.tween(250, (q) => minis.forEach((m) => (m.tag.alpha = q)));
    let since = 0,
      ticks = 0;
    this.loops.push((dt) => {
      since += dt;
      if (since < 60 || minis.every((m) => m.landed)) return;
      since = 0;
      for (const m of minis) if (!m.landed) m.num.text = String(1 + Math.floor(Math.random() * 100)).padStart(2, '0');
      sfx.tick(ticks++);
    });
    await this.wait(800);
    for (const [k, m] of minis.entries()) {
      await this.wait(k === minis.length - 1 ? 520 : 300);
      const ri = rarityIndex(m.p.rarity),
        tint = GLOW[m.p.rarity],
        cell = cells[k]!;
      m.landed = true;
      m.num.text = String(m.p.d100);
      m.num.tint = tint;
      if (ri >= 1) sfx.reveal(Math.max(0, ri - 1));
      else sfx.drop();
      const real = new Container();
      const rp = new Sprite(Texture.from(paperCanvas(Math.round(s), Math.round(s), PAPER[m.p.monster.paper].tone, PAPER[m.p.monster.paper].deckle)));
      rp.anchor.set(0.5);
      const rm = new Sprite(this.monsterTex(m.p.monster, 180));
      rm.anchor.set(0.5);
      rm.width = rm.height = s;
      real.addChild(rp, rm);
      real.alpha = 0;
      m.c.addChildAt(real, m.c.getChildIndex(m.tag));
      this.burstRing(cell.x, cell.y, tint, ri >= 2 ? 1.3 : 0.8, 500);
      if (ri >= 2) this.sparkles(cell.x, cell.y, tint, 6 + ri * 6, 100 + ri * 40);
      if (ri >= 3) this.quake(4 + ri * 2);
      void this.tween(450, (q) => {
        real.alpha = q;
        m.glow.alpha = [0, 0.35, 0.8, 1, 1][ri]! * q;
        m.frame.alpha = (ri ? 1 : 0.55) * q;
        m.tag.scale.set(1 + 0.5 * Math.sin(q * Math.PI));
        m.c.scale.set(1 + 0.1 * Math.sin(q * Math.PI));
      }, ease.out);
    }
    await this.wait(1000);
    // Der seltenste bekommt die große Bühne, bei Gleichstand der höhere Wurf
    let bestK = 0;
    ps.forEach((p, k) => {
      const a = rarityIndex(p.rarity),
        b = rarityIndex(ps[bestK]!.rarity);
      if (a > b || (a === b && p.d100 > ps[bestK]!.d100)) bestK = k;
    });
    const best = minis[bestK]!;
    sfx.lift();
    await this.tween(600, (q) => {
      minis.forEach((m, k) => {
        if (k !== bestK) m.c.alpha = 1 - 0.75 * q;
      });
      best.c.scale.set(1 + 0.25 * q);
    }, ease.inOut);
    await this.wait(300);
    await this.single(ps[bestK]!, { paint: false, roll: false });
    return ps[bestK]!;
  }
}
