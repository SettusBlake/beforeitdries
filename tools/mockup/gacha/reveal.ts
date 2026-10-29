/*
 * Ziehen als kleines Ritual (PixiJS, WebGL): Pinsel ins Glas, Tropfen fällt, Tinte blüht, W100 rollt, Karte dreht sich.
 * Die Würfe kommen von außen (in der App vom Server), hier wird nur inszeniert. Ein Tipp beschleunigt alles.
 */
import { Application, BlurFilter, Container, DisplacementFilter, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { PAPER, PIG } from '../../../src/shared/data';
import { RARITIES, rarityDef, rarityIndex, type Rarity } from '../../../src/shared/dice';
import type { Face } from '../../../src/shared/duel/rules';
import type { Monster } from '../../../src/shared/monster';
import { renderMonster } from '../../../src/client/renderer/watercolor';
import { iconSvg } from '../../../src/client/duel/icons';
import { sfx } from '../../../src/client/duel/sound';
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
const ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
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

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.bg, this.world, this.flash);
    this.world.addChild(this.back, this.mid, this.parts.layer, this.front);
    this.app.ticker.add((tk) => this.tick(tk.deltaMS));
    this.layout();
    window.addEventListener('resize', () => this.layout());
  }
  private layout(): void {
    this.W = this.app.screen.width;
    this.H = this.app.screen.height;
    this.bg.texture = Texture.from(backdropCanvas(this.W, this.H));
    this.world.pivot.set(this.W / 2, this.H / 2);
    this.world.position.set(this.W / 2, this.H / 2);
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
  private makeBrush(): { c: Container; tip: Graphics } {
    const c = new Container();
    const handle = new Graphics().roundRect(-6, -190, 12, 150, 6).fill({ color: 0x7a4a26 }).roundRect(-6, -190, 12, 30, 6).fill({ color: 0x1d2130 });
    const ferrule = new Graphics().roundRect(-7.5, -44, 15, 22, 3).fill({ color: 0xc8c6cc }).rect(-7.5, -38, 15, 2).fill({ color: 0x8d8a92 });
    const hair = new Graphics().moveTo(-7, -22).bezierCurveTo(-10, -2, -4, 14, 0, 26).bezierCurveTo(4, 14, 10, -2, 7, -22).closePath().fill({ color: 0x3a2b22 });
    const tip = new Graphics().moveTo(-6, 4).bezierCurveTo(-5, 14, -2, 20, 0, 26).bezierCurveTo(2, 20, 5, 14, 6, 4).closePath().fill({ color: 0xffffff });
    tip.alpha = 0;
    c.addChild(handle, ferrule, hair, tip);
    return { c, tip };
  }
  /** Aufdeckmaske: Tinte wächst in Flecken und Fasern aus der Mitte */
  private makeMask(size: number): { s: Sprite; draw: (p: number) => void } {
    const N = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const x = cv.getContext('2d')!;
    const tex = Texture.from(cv);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = size;
    const blobs = Array.from({ length: 9 }, (_, k) => ({ a: (k / 9) * Math.PI * 2 + Math.random() * 0.5, d: 0.08 + Math.random() * 0.28, r: 0.16 + Math.random() * 0.2, delay: Math.random() * 0.35 }));
    const fibers = Array.from({ length: 14 }, () => ({ a: Math.random() * Math.PI * 2, l: 0.3 + Math.random() * 0.25, w: 2 + Math.random() * 4, bend: (Math.random() - 0.5) * 0.6 }));
    const draw = (p: number) => {
      x.clearRect(0, 0, N, N);
      const c = N / 2;
      const soft = (px: number, py: number, r: number) => {
        if (r <= 0) return;
        const g = x.createRadialGradient(px, py, r * 0.55, px, py, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      };
      soft(c, c, N * 0.62 * ease.out(p));
      for (const b of blobs) {
        const q = clamp01((p - b.delay) / (1 - b.delay));
        soft(c + Math.cos(b.a) * b.d * N * q, c + Math.sin(b.a) * b.d * N * q, b.r * N * ease.out(q) * 1.3);
      }
      x.strokeStyle = 'rgba(255,255,255,.85)';
      x.lineCap = 'round';
      for (const f of fibers) {
        const l = f.l * N * ease.out(clamp01(p * 1.3));
        x.lineWidth = f.w;
        x.beginPath();
        x.moveTo(c, c);
        x.quadraticCurveTo(c + Math.cos(f.a + f.bend) * l * 0.6, c + Math.sin(f.a + f.bend) * l * 0.6, c + Math.cos(f.a) * l, c + Math.sin(f.a) * l);
        x.stroke();
      }
      if (p >= 1) {
        x.fillStyle = 'white';
        x.fillRect(0, 0, N, N);
      }
      tex.source.update();
    };
    draw(0);
    return { s, draw };
  }

  /* ---------- Ein Zug ---------- */
  /** Seltenheit in Stufen: bei Rare und besser beginnt das Glas manchmal eine Stufe tiefer und springt dann */
  private hintPath(ri: number): number[] {
    if (ri === 4) return [2, 3, 4];
    if (ri >= 2 && Math.random() < 0.55) return [ri - 1, ri];
    return [ri];
  }
  private geometry() {
    const S = Math.min(this.W * 0.74, this.H * 0.42, 340);
    return { S, cx: this.W / 2, cy: this.H * 0.36, jarY: this.H * 0.86 };
  }

  /** Der ganze Ablauf eines Zugs. intro=false beginnt mit dem fertigen Klecks (nach dem Zehnerzug) */
  async single(p: RevealPull, intro = true): Promise<void> {
    this.reset();
    const ri = rarityIndex(p.rarity);
    const g = this.geometry();
    const tint = GLOW[p.rarity];
    const pig = rgbNum(PIG[p.monster.main].rgb);
    const faceTexP = Promise.all(p.faces.map((f) => this.faceTex(f)));
    const mtex = this.monsterTex(p.monster, 512);

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

    // Das Blatt: leeres Papier, darüber der Klecks hinter einer wachsenden Maske, leicht verzerrt solange nass
    const sheet = new Container();
    sheet.position.set(g.cx, g.cy);
    const paper = new Sprite(Texture.from(paperCanvas(Math.round(g.S), Math.round(g.S), PAPER[p.monster.paper].tone, PAPER[p.monster.paper].deckle)));
    paper.anchor.set(0.5);
    const ink = new Container();
    const mon = new Sprite(mtex);
    mon.anchor.set(0.5);
    mon.width = mon.height = g.S;
    const mask = this.makeMask(g.S);
    ink.addChild(mon, mask.s);
    mon.mask = mask.s;
    const disp = new Sprite(noiseTex());
    disp.texture.source.addressMode = 'repeat';
    disp.anchor.set(0.5);
    disp.scale.set(2);
    disp.renderable = false;
    const dfilter = new DisplacementFilter({ sprite: disp, scale: 0 });
    ink.filters = [dfilter];
    const sheen = new Sprite(glowTex());
    sheen.anchor.set(0.5);
    sheen.blendMode = 'add';
    sheen.scale.set((g.S * 1.1) / 256);
    sheen.alpha = 0;
    sheet.addChild(paper, ink, sheen, disp);
    this.mid.addChild(sheet);
    this.loops.push((dt) => {
      if (disp.destroyed) return;
      disp.x += dt * 0.03;
      disp.y += dt * 0.017;
    });

    if (intro) {
      sheet.alpha = 0;
      sheet.scale.set(0.92);
      void this.tween(500, (q) => {
        sheet.alpha = q;
        sheet.scale.set(0.92 + 0.08 * q);
      }, ease.out);
      // 1. Eintauchen
      const hints = this.hintPath(ri);
      const jar = this.makeJar();
      jar.c.position.set(g.cx, g.jarY + 60);
      jar.c.alpha = 0;
      jar.setColor(GLOW[ORDER[hints[0]!]!]);
      const brush = this.makeBrush();
      brush.c.position.set(g.cx + 90, g.jarY - 260);
      brush.c.rotation = -0.5;
      this.mid.addChild(jar.c, brush.c);
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
      for (let k = 0; k < 3; k++) window.setTimeout(() => this.burstRing(g.cx, g.jarY - 6, GLOW[ORDER[hints[0]!]!], 0.5, 600, 0.25), k * 140 / this.speed);
      brush.tip.tint = GLOW[ORDER[hints[0]!]!];
      void this.tween(300, (q) => (brush.tip.alpha = q));
      const pulse = (q: number) => (jar.glow.alpha = 0.45 + 0.35 * Math.sin(q * Math.PI));
      await this.tween(520, pulse);
      // Die Farbe springt höher
      for (let h = 1; h < hints.length; h++) {
        const from = GLOW[ORDER[hints[h - 1]!]!],
          to = GLOW[ORDER[hints[h]!]!];
        sfx.upgrade();
        this.quake(5);
        this.burstRing(g.cx, g.jarY, to, 1.1, 650);
        this.sparkles(g.cx, g.jarY - 10, to, 18, 160);
        await this.tween(380, (q) => {
          jar.setColor(mixColor(from, to, q));
          brush.tip.tint = mixColor(from, to, q);
          jar.glow.scale.set(1.3 + 0.9 * Math.sin(q * Math.PI));
          jar.glow.alpha = 0.6 + 0.4 * Math.sin(q * Math.PI);
        }, ease.out);
        await this.wait(260);
      }
      // 2. Pinsel hebt sich über das Blatt, ein Tropfen hängt an der Spitze
      sfx.lift();
      const topY = g.cy - g.S / 2 - 66;
      await this.tween(700, (q) => {
        brush.c.x = lerp(g.cx + 6, g.cx, q);
        brush.c.y = lerp(g.jarY - 8, topY, q);
        brush.c.rotation = lerp(-0.12, 0, q);
        jar.c.alpha = 1 - q * 0.75;
      }, ease.inOut);
      const drop = new Sprite(dropTex());
      drop.anchor.set(0.5, 0.35);
      drop.tint = tint;
      drop.position.set(g.cx, topY + 28);
      drop.scale.set(0);
      const dglow = new Sprite(glowTex());
      dglow.anchor.set(0.5);
      dglow.tint = tint;
      dglow.blendMode = 'add';
      dglow.scale.set(0);
      this.front.addChild(dglow, drop);
      await this.tween(420, (q) => {
        drop.scale.set(0.24 * q, 0.24 * q * (1 + 0.25 * q));
        dglow.scale.set(0.5 * q);
        dglow.position.copyFrom(drop.position);
      }, ease.back);
      // 3. Der Tropfen fällt in Zeitlupe, die Kamera rückt nah
      sfx.fall();
      void this.tween(400, (q) => {
        brush.c.y = topY - 260 * q;
        brush.c.alpha = 1 - q;
      }, ease.in);
      const y0 = drop.y,
        y1 = g.cy;
      let trail = 0;
      await this.tween(1100, (q) => {
        drop.y = lerp(y0, y1, q);
        drop.scale.set(0.24 - 0.04 * q, 0.24 + 0.12 * q);
        dglow.position.copyFrom(drop.position);
        this.world.scale.set(1 + 0.07 * q);
        trail += 1;
        if (trail % 2 === 0) this.parts.spawn({ tex: glowTex(), x: drop.x + (Math.random() - 0.5) * 4, y: drop.y - 6, vy: -20, life: 420, tint, add: true, alpha: 0.6, scale: 0.16, scaleEnd: 0.02 });
      }, (x) => (x < 0.8 ? 0.55 * ease.inOut(x / 0.8) : 0.55 + 0.45 * ease.in((x - 0.8) / 0.2)));
      drop.destroy();
      dglow.destroy();
      // 4. Aufschlag: Druckwelle, Spritzer, Wellen im nassen Papier
      sfx.splash();
      this.quake(12);
      this.whiteFlash(0.35, 380, tint);
      this.burstRing(g.cx, g.cy, tint, 2.6, 800);
      this.burstRing(g.cx, g.cy, 0xffffff, 1.6, 500);
      this.droplets(g.cx, g.cy, pig, 30, 420);
      sheen.alpha = 0.55;
      sheen.tint = tint;
      dfilter.scale.x = dfilter.scale.y = 70;
      void this.tween(500, (q) => this.world.scale.set(1.07 - 0.07 * q), ease.out);
      // 5. Die Tinte blüht
      sfx.swell(ri);
      await this.tween(1700, (q) => {
        mask.draw(q);
        dfilter.scale.x = dfilter.scale.y = 70 * (1 - q) + 6;
        if (Math.random() < 0.25) this.parts.spawn({ tex: dropTex(), x: g.cx + (Math.random() - 0.5) * g.S * q * 0.8, y: g.cy + (Math.random() - 0.5) * g.S * q * 0.8, life: 600, tint: pig, alpha: 0.5, scale: 0.05, scaleEnd: 0.0 });
      }, ease.out);
      mask.draw(1);
      // Die Farbe trocknet: Glanz verschwindet, Verzerrung legt sich
      void this.tween(900, (q) => {
        sheen.alpha = 0.55 * (1 - q);
        dfilter.scale.x = dfilter.scale.y = 6 * (1 - q);
      }, ease.out).then(() => {
        if (!ink.destroyed) ink.filters = [];
      });
      jar.c.destroy({ children: true });
      brush.c.destroy({ children: true });
    } else {
      mask.draw(1);
      ink.filters = [];
      sheet.scale.set(0.6);
      sheet.alpha = 0;
      await this.tween(500, (q) => {
        sheet.alpha = q;
        sheet.scale.set(0.6 + 0.4 * q);
      }, ease.back);
    }

    // 6. Der Wurf: W100 rollt, die Leiste füllt sich
    const numY = g.cy + g.S / 2 + 62;
    const label = new Text({ text: 'd100', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: '700', fill: 0xbdb3a6, letterSpacing: 3 } });
    label.anchor.set(0.5);
    label.position.set(g.cx, numY - 44);
    const num = new Text({ text: '00', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 64, fontWeight: '800', fill: 0xfdf8ee, stroke: { color: 0x15111a, width: 6 } } });
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
    const steps = 18;
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

    // 7. Die Seltenheit: Strahlen, Hof, Funkeln, bei Legendary Blattgold
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
    const card = this.makeCard(p, mtex, g.S, faces);
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
  /** Zehn Tropfen regnen auf zehn Blätter, der seltenste zuletzt. Danach die große Enthüllung für ihn */
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
      const glow = new Sprite(glowTex());
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = GLOW[p.rarity];
      glow.scale.set((s * (rarityIndex(p.rarity) >= 2 ? 2.6 : 2)) / 256);
      glow.alpha = 0;
      // Rahmen in der Farbe der Seltenheit, damit man sie auch klein sofort erkennt
      const ri0 = rarityIndex(p.rarity);
      const frame = new Graphics().roundRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8, 7).stroke({ width: ri0 >= 2 ? 4 : 2.5, color: GLOW[p.rarity] });
      frame.alpha = 0;
      const paper = new Sprite(Texture.from(paperCanvas(Math.round(s), Math.round(s), PAPER[p.monster.paper].tone, PAPER[p.monster.paper].deckle)));
      paper.anchor.set(0.5);
      const mon = new Sprite(this.monsterTex(p.monster, 180));
      mon.anchor.set(0.5);
      mon.width = mon.height = s;
      // Unscharf nur während des Aufblühens, sonst kostet jedes Blatt einen Filter pro Bild
      mon.visible = false;
      const blur = new BlurFilter({ strength: 10 });
      c.addChild(glow, frame, paper, mon);
      c.alpha = 0.55;
      this.mid.addChild(c);
      return { c, glow, frame, mon, blur, p };
    });
    await this.tween(400, (q) => minis.forEach((m) => (m.c.alpha = 0.55 * q)));
    const order = ps.map((p, k) => [k, rarityIndex(p.rarity)] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [n, [k, ri]] of order.entries()) {
      const m = minis[k]!;
      const cell = cells[k]!;
      const tint = GLOW[m.p.rarity];
      const drop = new Sprite(dropTex());
      drop.anchor.set(0.5);
      drop.tint = tint;
      drop.scale.set(0.16, 0.22);
      drop.position.set(cell.x, -20);
      this.front.addChild(drop);
      const last = n === order.length - 1;
      if (last && ri >= 2) {
        // Der beste kommt langsamer
        await this.wait(500);
        sfx.fall();
      }
      await this.tween(last ? 900 : 360, (q) => {
        drop.y = lerp(-20, cell.y, q);
        if (Math.random() < 0.5) this.parts.spawn({ tex: glowTex(), x: drop.x, y: drop.y - 6, vy: -20, life: 300, tint, add: true, alpha: 0.5, scale: 0.1, scaleEnd: 0.02 });
      }, ease.in);
      drop.destroy();
      if (ri >= 2 || last) sfx.splash();
      else sfx.drop();
      this.burstRing(cell.x, cell.y, tint, ri >= 2 ? 1.3 : 0.8, 500);
      this.droplets(cell.x, cell.y, rgbNum(PIG[m.p.monster.main].rgb), 8 + ri * 4, 220);
      if (ri >= 2) this.sparkles(cell.x, cell.y, tint, 6 + ri * 6, 100 + ri * 40);
      if (ri >= 3) this.quake(4 + ri * 2);
      if (ri >= 1) sfx.reveal(Math.max(0, ri - 1));
      m.mon.alpha = 0;
      m.mon.visible = true;
      m.mon.filters = [m.blur];
      void this.tween(700, (q) => {
        m.c.alpha = 0.55 + 0.45 * q;
        m.mon.alpha = q;
        m.blur.strength = 10 * (1 - q);
        m.glow.alpha = [0, 0.35, 0.8, 1, 1][ri]! * q;
        m.frame.alpha = (ri ? 1 : 0.55) * q;
        m.c.scale.set(1 + 0.12 * Math.sin(q * Math.PI));
      }, ease.out).then(() => {
        if (!m.mon.destroyed) m.mon.filters = [];
      });
      await this.wait(last ? 600 : 160);
    }
    await this.wait(500);
    // Der seltenste bekommt die große Bühne
    const bestK = order[order.length - 1]![0];
    const best = minis[bestK]!;
    sfx.lift();
    await this.tween(600, (q) => {
      minis.forEach((m, k) => {
        if (k !== bestK) m.c.alpha = 1 - 0.75 * q;
      });
      best.c.scale.set(1 + 0.25 * q);
    }, ease.inOut);
    await this.wait(300);
    await this.single(ps[bestK]!, false);
    return ps[bestK]!;
  }
}
