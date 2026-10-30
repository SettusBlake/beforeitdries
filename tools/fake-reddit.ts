/* Reddit-Attrappe für Tests und die lokale Vorschau */
import type { CommentLike, RedditLike } from '../src/server/core';

export class FakeReddit implements RedditLike {
  posts: { id: string; title: string; postData: unknown; entry?: string; sticky?: boolean }[] = [];
  comments = new Map<string, CommentLike[]>();
  appComments: { id: string; text: string }[] = [];
  private n = 0;

  async submitCustomPost(opts: Parameters<RedditLike['submitCustomPost']>[0]) {
    const id = `t3_fake${++this.n}`;
    this.posts.push({ id, title: opts.title, postData: opts.postData, ...(opts.entry ? { entry: opts.entry } : {}) });
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
  async submitComment(opts: { id: `t3_${string}`; text: string }) {
    this.appComments.push({ id: opts.id, text: opts.text });
    return {};
  }
  mods: string[] = [];
  getModerators(opts: { subredditName: string; username?: string }) {
    const list = this.mods.filter((m) => !opts.username || m.toLowerCase() === opts.username.toLowerCase());
    return { all: async () => list.map((username) => ({ username })) };
  }
  addComment(postId: string, authorName: string, body: string, score: number, extra: Partial<CommentLike> = {}) {
    const list = this.comments.get(postId) ?? [];
    list.push({ id: `t1_c${++this.n}`, parentId: postId, body, score, authorName, authorId: `t2_${authorName}`, removed: false, createdAt: new Date(1e12 + this.n * 1000), ...extra });
    this.comments.set(postId, list);
  }
}
