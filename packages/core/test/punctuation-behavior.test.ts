/**
 * Punctuation 行为锁定（2026-10-11 查漏结论）：
 * - `...` → `……`、`---` → `——` 均已覆盖；
 * - 英文语境下的 `...` 同样转为 `……`，这是旧版原有行为（中文出版惯例：
 *   中文书里的英文省略号也排成……），保持不动，特此锁定。
 */
import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';

const T = (s: string) =>
  getTransform('Punctuation').run(s, [], { config: defaultConfig });

describe('punctuation ellipsis/dash', () => {
  it('converts ... to ……', () => {
    expect(T('等了...')).toBe('等了……');
  });
  it('converts --- to ——', () => {
    expect(T('他说---然后走了')).toBe('他说——然后走了');
  });
  it('keeps English ellipsis as …… (legacy behavior)', () => {
    expect(T('He said...')).toBe('He said……');
  });
  it('dedupes repeated punctuation', () => {
    expect(T('！！！！')).toBe('！！！');
    expect(T('？？？？')).toBe('？？？');
  });
});
