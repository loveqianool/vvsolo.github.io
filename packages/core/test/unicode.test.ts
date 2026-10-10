import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import type { RunContext } from '../src/types';
import { transform } from '../src/transforms/unicode';
import { loadTransformFixtures } from './helpers';

const ctx: RunContext = { config: defaultConfig };

describe('Unicode', () => {
  const fx = loadTransformFixtures('Unicode');
  it(`id/title registered (${fx.cases.length} cases)`, () => {
    expect(transform.id).toBe('Unicode');
  });
  for (const c of fx.cases) {
    it(`corpus:${c.corpus}`, () => {
      expect(transform.run(c.input, fx.args, ctx)).toBe(c.output);
    });
  }
});
