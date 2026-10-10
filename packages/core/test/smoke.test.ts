import { describe, expect, it } from 'vitest';
import { getTransform, listTransforms, runPipeline } from '../src/index';

describe('registry smoke', () => {
  it('runPipeline with no steps returns the input unchanged', () => {
    expect(runPipeline('hello 你好', [])).toBe('hello 你好');
    expect(runPipeline('', [])).toBe('');
  });

  it('getTransform throws on unknown id', () => {
    expect(() => getTransform('不存在')).toThrow('unknown transform: 不存在');
  });

  it('listTransforms aggregates every transform in ./transforms', () => {
    const ids = listTransforms().map((t) => t.id);
    for (const id of [
      'Init',
      'Finish',
      'End',
      'Space',
      'Number',
      'Letter',
      'NumberLetter',
    ]) {
      expect(ids).toContain(id);
    }
    // id 唯一
    expect(new Set(ids).size).toBe(ids.length);
  });
});
