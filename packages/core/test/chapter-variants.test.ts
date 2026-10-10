/**
 * Chapter 变体增强回归测试（2026-10-11）：
 * 新增识别的章节标题变体：终章/终曲、序幕、别传、最终话/最终回、
 * 间幕/幕间、上部/下部/中部、其一/其二、No.1。
 * 故意不收：单字"跋"（误伤风险高）、英文单词数字（Chapter One）、
 * 罗马数字（Part II）。
 */
import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';

const T = getTransform('Chapter');
const run = (s: string) => T.run(s, ['fix'], { config: defaultConfig });

describe('chapter variants', () => {
  const hits: Array<[string, string]> = [
    ['终章', '\n\n终章'],
    ['终曲', '\n\n终曲'],
    ['序幕', '\n\n序幕'],
    ['别传', '\n\n别传'],
    ['别篇', '\n\n别篇'],
    ['最终话', '\n\n最终话'],
    ['最终回', '\n\n最终回'],
    ['间幕', '\n\n间幕'],
    ['幕间', '\n\n幕间'],
    ['上部', '\n\n上部'],
    ['下部', '\n\n下部'],
    ['中部', '\n\n中部'],
    ['No.1', '\n\n第01章'],
    ['NO.3', '\n\n第03章'],
  ];
  for (const [input, expected] of hits) {
    it(`recognizes ${input}`, () => {
      expect(run(input)).toBe(expected);
    });
  }

  it('recognizes 其一/其二', () => {
    expect(run('其一')).toBe('\n\n其（一）');
    expect(run('其二')).toBe('\n\n其（二）');
  });

  const misses = ['跋', 'Chapter One', 'Part II', '他说终章很好看', '2024年1月1日'];
  for (const input of misses) {
    it(`leaves alone ${input}`, () => {
      expect(run(input)).toBe(input);
    });
  }
});
