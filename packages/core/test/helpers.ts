/**
 * fixture 加载辅助：从 ~/workspace/fixtures-backup/*.json 读测试数据。
 * 可用环境变量 FIXTURE_DIR 覆盖目录。
 *
 * 注意：typesetSplit 等 pipeline 的 expected 里可能含 `__DATE__` 占位，
 * 这里保持原样透出，由后续的 pipeline 测试自行替换处理。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR =
  process.env.FIXTURE_DIR ?? '/home/hatch/workspace/fixtures-backup';

export interface FixtureCase {
  corpus: string;
  input: string;
  output: string;
}

export interface TransformFixture {
  id: string;
  args: string[];
  cases: FixtureCase[];
}

export function loadTransformFixtures(id: string): TransformFixture {
  const all = JSON.parse(
    readFileSync(join(FIXTURE_DIR, 'transforms.json'), 'utf8'),
  ) as TransformFixture[];
  const f = all.find((x) => x.id === id);
  if (!f) throw new Error(`no transform fixture: ${id}`);
  return f;
}

export interface PipelineFixture {
  pipeline: string;
  corpus: string;
  input: string;
  output: string;
  options: Record<string, unknown>;
}

export function loadPipelineFixtures(pipeline: string): PipelineFixture[] {
  const all = JSON.parse(
    readFileSync(join(FIXTURE_DIR, 'pipelines.json'), 'utf8'),
  ) as PipelineFixture[];
  return all.filter((x) => x.pipeline === pipeline);
}
