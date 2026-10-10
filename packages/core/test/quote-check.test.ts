/** checkQuotes 回归测试（2026-10-11） */
import { describe, expect, it } from 'vitest';
import { checkQuotes } from '../src/index';

describe('checkQuotes', () => {
  it('returns empty for balanced text', () => {
    expect(checkQuotes('他说：“你好。”\n她说：‘嗯。’\n「好的」\n『行』\n"He said."\n').length).toBe(0);
  });
  it('flags odd straight quotes', () => {
    const issues = checkQuotes('他说：“你好。\n第二行\n');
    expect(issues.length).toBe(1);
    expect(issues[0].line).toBe(1);
    expect(issues[0].detail).toContain('弯双引号');
  });
  it('flags odd straight double quotes', () => {
    const issues = checkQuotes('say "hello\n');
    expect(issues.length).toBe(1);
    expect(issues[0].detail).toContain('"');
  });
  it('reports 1-based line numbers', () => {
    const issues = checkQuotes('ok\n“oops\nok\n');
    expect(issues.map((x) => x.line)).toEqual([2]);
  });
});
