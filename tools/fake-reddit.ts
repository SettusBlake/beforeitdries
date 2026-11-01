/* Reddit-Attrappe für Tests und die lokale Vorschau */
import type { CommentLike, RedditLike } from '../src/server/core';

export class FakeReddit implements RedditLike {
  posts: { id: string; title: string; postData: unknown; entry?: string; sticky?: boolean; runAs?: 'USER' | 'APP'; ugc?: string }[] = [];
  comments = new Map<string, CommentLike[]>();
  /** Geschriebene Kommentare: id ist das Ziel (Post oder Kommentar), cid die neue ID */
  appComments: { id: string; cid: string; text: string; runAs?: 'USER' | 'APP'; sticky?: boolean; deleted?: boolean }[] = [];
  private n = 0;

  async submitCustomPost(opts: Parameters<RedditLike['submitCustomPost']>[0]) {
    const id = `t3_fake${++this.n}`;
    this.posts.push({ id, title: opts.title, postData: opts.postData, ...(opts.entry ? { entry: opts.entry } : {}), ...(opts.runAs ? { runAs: opts.runAs } : {}), ...(opts.userGeneratedContent ? { ugc: opts.userGeneratedContent.text } : {}) });
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
  async getUserById(id: `t2_${string}`) {
    return { createdAt: new Date(this.born.get(id) ?? Date.parse('2025-10-01T00:00:00Z')) };
  }
  messages: { to: string; subject: string; text: string }[] = [];
  async sendPrivateMessage(opts: { to: string; subject: string; text: string }) {
    this.messages.push(opts);
  }
  addComment(postId: string, authorName: string, body: string, score: number, extra: Partial<CommentLike> = {}) {
    const list = this.comments.get(postId) ?? [];
    list.push({ id: `t1_c${++this.n}`, parentId: postId, body, score, authorName, authorId: `t2_${authorName}`, removed: false, createdAt: new Date(1e12 + this.n * 1000), ...extra });
    this.comments.set(postId, list);
  }
}
