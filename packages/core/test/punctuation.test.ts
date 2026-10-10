import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';
import { loadTransformFixtures } from './helpers';

describe('Punctuation', () => {
  const t = getTransform('Punctuation');
  const fx = loadTransformFixtures('Punctuation');
  for (const c of fx.cases) {
    it(c.corpus, () => {
      expect(t.run(c.input, fx.args ?? [], { config: defaultConfig })).toBe(
        c.output,
      );
    });
  }
});
