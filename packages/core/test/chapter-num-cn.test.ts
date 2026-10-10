/** ChapterNumCn 回归测试：括号序号转中文 */
import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';

const T = (s: string) =>
  getTransform('ChapterNumCn').run(s, [], { config: defaultConfig });

describe('ChapterNumCn', () => {
  it('converts (N) to 第一章：title', () => {
    expect(T('(1) 标题测试')).toBe('第一章：标题测试');
    expect(T('(01)标题测试')).toBe('第一章：标题测试');
    expect(T('（12）标题测试')).toBe('第十二章：标题测试');
  });
  it('handles tens/hundreds/thousands', () => {
    expect(T('(10) x')).toBe('第十章：x');
    expect(T('(20) x')).toBe('第二十章：x');
    expect(T('(21) x')).toBe('第二十一章：x');
    expect(T('(101) x')).toBe('第一百零一章：x');
    expect(T('(1001) x')).toBe('第一千零一章：x');
  });
  it('keeps lines without bracket numbers unchanged', () => {
    expect(T('第一章：标题')).toBe('第一章：标题');
    expect(T('正文内容第一行。')).toBe('正文内容第一行。');
    expect(T('(0) 无效')).toBe('(0) 无效');
    expect(T('前言 (1) 补充')).toBe('前言 (1) 补充');
  });
  it('bare number becomes 第一章 without colon', () => {
    expect(T('(3)')).toBe('第三章');
  });
  it('works on the user reported case', () => {
    expect(T('(2) 隐奸老婆！让老婆全裸')).toBe('第二章：隐奸老婆！让老婆全裸');
  });
});
