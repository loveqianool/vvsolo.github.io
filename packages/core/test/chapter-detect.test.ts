/** detectChapters 回归测试 */
import { describe, expect, it } from 'vitest';
import { detectChapters } from '../src/index';

const text = [
  '第一章 启程',
  '正文内容第一行。',
  '正文内容第二行。',
  '第二章',
  '他说第一卷很好看。',
  '番外',
  '尾声',
].join('\n');

describe('detectChapters', () => {
  it('finds chapter lines with 1-based numbers', () => {
    const toc = detectChapters(text);
    expect(toc.map((x) => x.line)).toEqual([1, 4, 6, 7]);
    expect(toc[0].title).toBe('第一章 启程');
    expect(toc[2].title).toBe('番外');
  });
  it('ignores body text mentioning chapters', () => {
    const toc = detectChapters('他说第一卷很好看。\n2024年1月1日\n');
    expect(toc).toEqual([]);
  });
});
