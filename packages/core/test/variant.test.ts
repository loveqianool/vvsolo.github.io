import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import type { RunContext } from '../src/types';
import { transform } from '../src/transforms/variant';
import { loadTransformFixtures } from './helpers';

const ctx: RunContext = { config: defaultConfig };

describe('Variant', () => {
  const fx = loadTransformFixtures('Variant');
  it(`id/title registered (${fx.cases.length} cases)`, () => {
    expect(transform.id).toBe('Variant');
  });
  for (const c of fx.cases) {
    it(`corpus:${c.corpus}`, () => {
      expect(transform.run(c.input, fx.args, ctx)).toBe(c.output);
    });
  }
});
