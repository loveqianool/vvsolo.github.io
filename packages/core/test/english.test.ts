import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import type { RunContext } from '../src/types';
import { transform } from '../src/transforms/english';
import { loadTransformFixtures } from './helpers';

const ctx: RunContext = { config: defaultConfig };

describe('English', () => {
  const fx = loadTransformFixtures('English');
  it(`id/title registered (${fx.cases.length} cases)`, () => {
    expect(transform.id).toBe('English');
  });
  // 注意：mask 占位编号（〔☯N〕）依赖模块级共享状态在 case 间的累积，
  // 与 fixture 生成时的顺序语义一致，因此 cases 必须按原顺序执行。
  for (const c of fx.cases) {
    it(`corpus:${c.corpus}`, () => {
      expect(transform.run(c.input, fx.args, ctx)).toBe(c.output);
    });
  }
});
