/**
 * Chapter transform 回归测试：跑 fixtures-backup/transforms.json 里全部
 * id === 'Chapter' 的条目（args 分别为 nofix / fix / center 三种）。
 *
 * 注意 helpers.loadTransformFixtures 只返回第一个同名条目，
 * 这里直接读 JSON 取全部三个，保证三种 args 全覆盖。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTransform } from '../src/index';
import { defaultConfig } from '../src/types';
import type { FixtureCase } from './helpers';

const DIR = process.env.FIXTURE_DIR ?? '/home/hatch/workspace/fixtures-backup';

interface ChapterFixture {
  id: string;
  args: string[];
  cases: FixtureCase[];
}

const fixtures = (
  JSON.parse(readFileSync(join(DIR, 'transforms.json'), 'utf8')) as ChapterFixture[]
).filter((x) => x.id === 'Chapter');

describe('Chapter transform fixtures', () => {
  expect(fixtures.length).toBe(3);
  for (const f of fixtures) {
    describe(`args=${JSON.stringify(f.args)}`, () => {
      for (const c of f.cases) {
        it(c.corpus, () => {
          const out = getTransform('Chapter').run(c.input, f.args, {
            config: defaultConfig,
          });
          expect(out).toBe(c.output);
        });
      }
    });
  }
});
