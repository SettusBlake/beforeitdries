/* Reddit-Attrappe für Tests und die lokale Vorschau */
import type { CommentLike, FlairInput, PostLike, RedditLike, RuleInput, WidgetInput, WikiInput } from '../src/server/core';

export class FakeReddit implements RedditLike {
  posts: { id: string; title: string; postData: unknown; entry?: string; sticky?: boolean; runAs?: 'USER' | 'APP'; ugc?: string; author: string; removed?: boolean }[] = [];
  /** Name des App-Kontos (Posts ohne runAs USER) und des Spielers, der im Playtest als USER postet */
  appUser = 'beforeitdries';
  actingUser = 'Vegavild';
  comments = new Map<string, CommentLike[]>();
  /** Geschriebene Kommentare: id ist das Ziel (Post oder Kommentar), cid die neue ID */
  appComments: { id: string; cid: string; text: string; runAs?: 'USER' | 'APP'; sticky?: boolean; deleted?: boolean }[] = [];
  private n = 0;

  async submitCustomPost(opts: Parameters<RedditLike['submitCustomPost']>[0]) {
    const id = `t3_fake${++this.n}`;
    this.posts.push({ id, title: opts.title, postData: opts.postData, author: opts.runAs === 'USER' ? this.actingUser : this.appUser, ...(opts.entry ? { entry: opts.entry } : {}), ...(opts.runAs ? { runAs: opts.runAs } : {}), ...(opts.userGeneratedContent ? { ugc: opts.userGeneratedContent.text } : {}) });
    return { id, url: `https://www.reddit.com/r/${opts.subredditName}/comments/${id.slice(3)}/`, permalink: `/r/${opts.subredditName}/comments/${id.slice(3)}/` };
  }
  async getPostById(id: `t3_${string}`) {
    const p = this.posts.find((x) => x.id === id);
    return {
      sticky: async () => {
        if (p) p.sticky = true;
      },
    };
  }
  getComments(opts: { postId: `t3_${string}` }) {
    return { all: async () => [...(this.comments.get(opts.postId) ?? [])] };
  }
  async submitComment(opts: { id: `t3_${string}` | `t1_${string}`; text: string; runAs?: 'USER' | 'APP' }) {
    const c: FakeReddit['appComments'][number] = { id: opts.id, cid: `t1_app${++this.n}`, text: opts.text, ...(opts.runAs ? { runAs: opts.runAs } : {}) };
    this.appComments.push(c);
    return {
      id: c.cid,
      distinguish: async (makeSticky?: boolean) => {
        if (makeSticky) c.sticky = true;
      },
    };
  }
  async getCommentById(id: `t1_${string}`) {
    return {
      delete: async () => {
        const c = this.appComments.find((x) => x.cid === id);
        if (c) c.deleted = true;
      },
    };
  }
  mods: string[] = [];
  getModerators(opts: { subredditName: string; username?: string }) {
    const list = this.mods.filter((m) => !opts.username || m.toLowerCase() === opts.username.toLowerCase());
    return { all: async () => list.map((username) => ({ username })) };
  }
  /** Anlage der Konten (fehlt: ein Jahr alt) */
  born = new Map<string, number>();
  /** Gelöschte oder gesperrte Konten: Reddit findet sie nicht */
  gone = new Set<string>();
  async getUserById(id: `t2_${string}`) {
    if (this.gone.has(id)) return undefined;
    return { createdAt: new Date(this.born.get(id) ?? Date.parse('2025-10-01T00:00:00Z')) };
  }
  messages: { to: string; subject: string; text: string }[] = [];
  async sendPrivateMessage(opts: { to: string; subject: string; text: string }) {
    this.messages.push(opts);
  }
  /* ---------- Auftritt des Subreddits (community.ts) ---------- */
  rules: RuleInput[] = [];
  async getRules() {
    return this.rules.map((r) => ({
      shortName: r.shortName,
      update: async (o: RuleInput) => {
        Object.assign(r, o);
      },
    }));
  }
  async createRule(_sub: string, o: RuleInput) {
    if (this.rules.some((r) => r.shortName === o.shortName)) throw new Error('rule exists');
    this.rules.push({ ...o });
  }
  reasons: { id: string; title: string; message: string }[] = [];
  async getSubredditRemovalReasons() {
    return this.reasons.map((r) => ({ id: r.id, title: r.title }));
  }
  async addSubredditRemovalReason(_sub: string, o: { title: string; message: string }) {
    const id = `rr${++this.n}`;
    this.reasons.push({ id, ...o });
    return id;
  }
  async updateSubredditRemovalReason(_sub: string, id: string, o: { title: string; message: string }) {
    Object.assign(this.reasons.find((r) => r.id === id)!, o);
  }
  flairs: (FlairInput & { id: string })[] = [];
  async getPostFlairTemplates() {
    return this.flairs.map((f) => ({ id: f.id, text: f.text }));
  }
  async createPostFlairTemplate(o: FlairInput) {
    const f = { ...o, id: `fl${++this.n}` };
    this.flairs.push(f);
    return { id: f.id };
  }
  async editFlairTemplate(o: FlairInput & { id: string }) {
    Object.assign(this.flairs.find((f) => f.id === o.id)!, o);
    return { id: o.id };
  }
  postFlair = new Map<string, string>();
  async setPostFlair(o: { postId: string; flairTemplateId: string }) {
    this.postFlair.set(o.postId, o.flairTemplateId);
  }
  widgets: (WidgetInput & { id: string })[] = [];
  async getWidgets() {
    return this.widgets.map((w) => ({ id: w.id, name: w.shortName }));
  }
  async addWidget(o: WidgetInput) {
    const w = { ...o, id: `w${++this.n}` };
    this.widgets.push(w);
    return { id: w.id };
  }
  async updateWidget(o: WidgetInput & { id: string }) {
    const i = this.widgets.findIndex((w) => w.id === o.id);
    this.widgets[i] = { ...o };
    return o;
  }
  wiki = new Map<string, string>();
  async getWikiPage(_sub: string, page: string) {
    const content = this.wiki.get(page);
    if (content === undefined) throw new Error('PAGE_NOT_FOUND');
    return { content };
  }
  async createWikiPage(o: WikiInput) {
    this.wiki.set(o.page, o.content);
    return {};
  }
  async updateWikiPage(o: WikiInput) {
    this.wiki.set(o.page, o.content);
    return {};
  }
  async getAppUser() {
    return { username: this.appUser };
  }
  /** Neueste zuerst, wie bei Reddit */
  getNewPosts(): { all(): Promise<PostLike[]> } {
    return {
      all: async () =>
        [...this.posts].reverse().map((p) => ({
          id: p.id,
          authorName: p.author,
          removed: !!p.removed,
          remove: async () => {
            p.removed = true;
          },
        })),
    };
  }
  addComment(postId: string, authorName: string, body: string, score: number, extra: Partial<CommentLike> = {}) {
    const list = this.comments.get(postId) ?? [];
    list.push({ id: `t1_c${++this.n}`, parentId: postId, body, score, authorName, authorId: `t2_${authorName}`, removed: false, createdAt: new Date(1e12 + this.n * 1000), ...extra });
    this.comments.set(postId, list);
  }
}
