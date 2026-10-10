/** 新增规则回归测试（2026-10-11）：HtmlTag、EmptyBrackets，默认关闭 */
import { describe, expect, it } from 'vitest';
import { getTransform, runCleanup } from '../src/index';
import { defaultConfig } from '../src/types';

const run = (id: string, s: string) =>
  getTransform(id).run(s, [], { config: defaultConfig });

describe('HtmlTag', () => {
  it('converts <br> to newline and strips other tags', () => {
    expect(run('HtmlTag', '<p>第一章</p><br/>正文<br>更多')).toBe(
      '第一章\n正文\n更多',
    );
  });
  it('strips comments', () => {
    expect(run('HtmlTag', 'a<!-- x -->b')).toBe('ab');
  });
  it('does not eat a<b without closing', () => {
    expect(run('HtmlTag', 'a<b 的情况')).toBe('a<b 的情况');
  });
});

describe('EmptyBrackets', () => {
  it('removes empty bracket pairs', () => {
    expect(run('EmptyBrackets', '第一章（）完')).toBe('第一章完');
    expect(run('EmptyBrackets', 'a""b')).toBe('ab');
    expect(run('EmptyBrackets', '「」x『』')).toBe('x');
  });
  it('keeps non-empty brackets', () => {
    expect(run('EmptyBrackets', '（一）')).toBe('（一）');
  });
});

describe('new rules are opt-in', () => {
  it('cleanup leaves them off by default', () => {
    // 默认 pipeline 不启用新规则（行为与旧版一致）
    expect(runCleanup('<p>Hi</p>')).toBe(runCleanup('<p>Hi</p>'));
    const out = runCleanup('<p>Hi</p>（）');
    expect(out).toContain('<');
  });
  it('cleanup enables them when requested', () => {
    const out = runCleanup('<p>Hi</p>（）', [
      'Init',
      'HtmlEntity',
      'HtmlTag',
      'EmptyBrackets',
      'End',
    ]);
    expect(out).not.toContain('<p>');
    expect(out).not.toContain('（）');
  });
});
