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
  it('detects long chapter titles up to 80 chars (was 40)', () => {
    // 用户实测：41 字标题 "(2) 隐奸老婆！..." 之前因 en:{0,40} 被漏掉
    const line =
      '(2) 隐奸老婆！让老婆全裸摆出M字腿，翘高屁股被会长全身精油按摩，我在外面听得又绿又兴奋';
    expect(line.slice(4).length).toBeGreaterThan(40);
    const toc = detectChapters(line);
    expect(toc).toHaveLength(1);
    expect(toc[0].title).toBe(line);
  });
  it('detects very long chapter titles up to 280 chars', () => {
    const line = '(99) ' + '超长标题'.repeat(50); // 200 字标题
    expect(line.slice(5).length).toBeGreaterThan(80);
    const toc = detectChapters(line);
    expect(toc).toHaveLength(1);
    expect(toc[0].title).toBe(line);
  });
});
