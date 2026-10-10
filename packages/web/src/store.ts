/** localStorage 持久化：草稿 / 规则开关 / 书籍信息 */

const PREFIX = 'typeset-web.';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 配额满等情况：静默失败，不阻塞主流程 */
  }
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export interface BookInfo {
  bookName: string;
  chapter: string;
  author: string;
  site: string;
  isFirst: boolean;
  addHeader: boolean;
}

export const BOOK_KEY = 'book';
export const DRAFT_KEY = 'draft';
export const RULES_KEY = 'rules.enabled';
