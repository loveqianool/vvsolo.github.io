import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';
import { loadTransformFixtures } from './helpers';

describe('Quote', () => {
  const t = getTransform('Quote');
  const fx = loadTransformFixtures('Quote');
  for (const c of fx.cases) {
    it(c.corpus, () => {
      expect(t.run(c.input, fx.args ?? [], { config: defaultConfig })).toBe(
        c.output,
      );
    });
  }
});
