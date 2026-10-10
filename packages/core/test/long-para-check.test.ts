/** checkLongParagraphs 回归测试 */
import { describe, expect, it } from 'vitest';
import { checkLongParagraphs } from '../src/index';

describe('checkLongParagraphs', () => {
  it('reports paragraphs over 300 chars with line numbers', () => {
    const long = '长'.repeat(301);
    const issues = checkLongParagraphs(`短段落。\n${long}\n\n另一短段。`);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(2);
    expect(issues[0].length).toBe(301);
  });
  it('ignores exactly-300 and empty lines', () => {
    expect(checkLongParagraphs('x'.repeat(300))).toEqual([]);
    expect(checkLongParagraphs('\n   \n')).toEqual([]);
  });
  it('respects custom threshold', () => {
    expect(checkLongParagraphs('y'.repeat(50), 40)).toHaveLength(1);
  });
});
