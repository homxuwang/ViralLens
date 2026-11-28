import Dexie, { type Table } from 'dexie';
import type { NoteContent } from './models';
export interface SavedMeta {
  action?: 'rewrite' | 'summarize';
  target?: 'wechat' | 'xiaohongshu' | 'x';
  level?: 'light' | 'medium' | 'deep';
}
export interface SavedContent { id: string; title: string; kind: string; body: string; sourceUrl: string; createdAt: string; original?: NoteContent; meta?: SavedMeta }
class Library extends Dexie {
  records!: Table<SavedContent, string>;
  constructor() { super('virallens'); this.version(1).stores({ records: 'id,kind,createdAt' }); }
}
export const library = new Library();
export async function saveContent(record: Omit<SavedContent, 'id' | 'createdAt'>) {
  return library.records.put({ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
}
