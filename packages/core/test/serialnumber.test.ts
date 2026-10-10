import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/types';
import type { RunContext } from '../src/types';
import { transform } from '../src/transforms/serialNumber';
import { loadTransformFixtures } from './helpers';

const ctx: RunContext = { config: defaultConfig };

describe('SerialNumber', () => {
  const fx = loadTransformFixtures('SerialNumber');
  it(`id/title registered (${fx.cases.length} cases)`, () => {
    expect(transform.id).toBe('SerialNumber');
  });
  for (const c of fx.cases) {
    it(`corpus:${c.corpus}`, () => {
      expect(transform.run(c.input, fx.args, ctx)).toBe(c.output);
    });
  }
});
