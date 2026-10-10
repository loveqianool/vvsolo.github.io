import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import { transform } from '../src/transforms/end';
import { loadTransformFixtures } from './helpers';

describe('End transform', () => {
  it('has the expected id', () => {
    expect(transform.id).toBe('End');
  });

  const fx = loadTransformFixtures('End');
  for (const [i, c] of fx.cases.entries()) {
    it(`case ${i} [${c.corpus}]`, () => {
      const args = (c as unknown as { args?: string[] }).args ?? fx.args ?? [];
      expect(transform.run(c.input, args, { config: defaultConfig })).toBe(c.output);
    });
  }
});
