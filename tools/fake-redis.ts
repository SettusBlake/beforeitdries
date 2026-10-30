/* Redis im Speicher, nur die Befehle, die das Spiel nutzt. Für Tests und die lokale Vorschau. */
import type { RedisLike } from '../src/server/core';

export class FakeRedis implements RedisLike {
  strings = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();

  private hash(key: string): Map<string, string> {
    let h = this.hashes.get(key);
    if (!h) this.hashes.set(key, (h = new Map()));
    return h;
  }
  private zset(key: string): Map<string, number> {
    let z = this.zsets.get(key);
    if (!z) this.zsets.set(key, (z = new Map()));
    return z;
  }

  async get(key: string) {
    return this.strings.get(key);
  }
  async set(key: string, value: string) {
    this.strings.set(key, value);
    return 'OK';
  }
  async mGet(keys: string[]) {
    return keys.map((k) => this.strings.get(k) ?? null);
  }
  async hGet(key: string, field: string) {
    return this.hashes.get(key)?.get(field);
  }
  async hSet(key: string, fv: Record<string, string>) {
    const h = this.hash(key);
    let added = 0;
    for (const [f, v] of Object.entries(fv)) {
      if (!h.has(f)) added++;
      h.set(f, v);
    }
    return added;
  }
  async hSetNX(key: string, field: string, value: string) {
    const h = this.hash(key);
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  }
  async incrBy(key: string, value: number) {
    const n = Number(this.strings.get(key) ?? 0) + value;
    this.strings.set(key, String(n));
    return n;
  }
  async hGetAll(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async hDel(key: string, fields: string[]) {
    const h = this.hashes.get(key);
    let n = 0;
    for (const f of fields) if (h?.delete(f)) n++;
    return n;
  }
  async hLen(key: string) {
    return this.hashes.get(key)?.size ?? 0;
  }
  async zAdd(key: string, ...members: { member: string; score: number }[]) {
    const z = this.zset(key);
    let added = 0;
    for (const m of members) {
      if (!z.has(m.member)) added++;
      z.set(m.member, m.score);
    }
    return added;
  }
  async zCard(key: string) {
    return this.zsets.get(key)?.size ?? 0;
  }
  async zRange(key: string, start: number | string, stop: number | string, options?: { reverse?: boolean; by: 'score' | 'lex' | 'rank' }) {
    const all = [...(this.zsets.get(key) ?? [])].map(([member, score]) => ({ member, score })).sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
    if (options?.reverse) all.reverse();
    const n = all.length,
      s = Number(start),
      e = Number(stop);
    const from = s < 0 ? Math.max(0, n + s) : s,
      to = e < 0 ? n + e : Math.min(e, n - 1);
    return all.slice(from, to + 1);
  }
}
