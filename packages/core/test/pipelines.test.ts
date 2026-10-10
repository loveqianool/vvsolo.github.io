/**
 * 4 条业务 pipeline 回归测试：fixtures-backup/pipelines.json。
 *
 * - cleanup → runCleanup(input) 全开
 * - cleanupEx → runCleanupEx(input)
 * - typesetSplit → runTypesetSplit(input, { author, site, now })，
 *   expected 里的 __DATE__ 占位用同样的 Intl 逻辑对固定日期生成后替换
 * - typesetRead → runTypesetRead(input)
 *
 * 注意顺序：cleanupEx 的 Chapter('fix','safe') 会永久改写 chapterModel.t2
 *（原实现语义），fixture 生成时也是 cleanup → cleanupEx → typesetSplit →
 * typesetRead 的顺序，因此这里保持同样的执行顺序。
 */
import { describe, expect, it } from 'vitest';
import {
  runCleanup,
  runCleanupEx,
  runTypesetRead,
  runTypesetSplit,
} from '../src/index';
import { loadPipelineFixtures } from './helpers';

const FIXED_NOW = new Date('2026-01-02');
const FIXED_DATE = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(FIXED_NOW);

describe('cleanup pipeline', () => {
  for (const c of loadPipelineFixtures('cleanup')) {
    it(c.corpus, () => {
      expect(runCleanup(c.input)).toBe(c.output);
    });
  }
  it('enabledIds 为空数组时全部跳过', () => {
    expect(runCleanup('第一章 测试\n正文。', [])).toBe('第一章 测试\n正文。');
  });
});

describe('cleanupEx pipeline', () => {
  for (const c of loadPipelineFixtures('cleanupEx')) {
    it(c.corpus, () => {
      expect(runCleanupEx(c.input)).toBe(c.output);
    });
  }
});

describe('typesetSplit pipeline', () => {
  for (const c of loadPipelineFixtures('typesetSplit')) {
    it(c.corpus, () => {
      const expected = c.output.replace('__DATE__', FIXED_DATE);
      const actual = runTypesetSplit(
        c.input,
        {
          author: c.options.author as string,
          site: c.options.site as string,
          now: FIXED_NOW,
        },
      );
      expect(actual).toBe(expected);
    });
  }
});

describe('typesetRead pipeline', () => {
  for (const c of loadPipelineFixtures('typesetRead')) {
    it(c.corpus, () => {
      expect(runTypesetRead(c.input)).toBe(c.output);
    });
  }
});
