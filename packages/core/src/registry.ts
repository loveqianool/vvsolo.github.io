import { defaultConfig } from './types';
import type { RunContext, Step, Transform } from './types';

const modules = import.meta.glob('./transforms/*.ts', {
  eager: true,
}) as Record<string, { transform: Transform }>;
const map = new Map<string, Transform>();
for (const m of Object.values(modules))
  if (m?.transform) map.set(m.transform.id, m.transform);

export function getTransform(id: string): Transform {
  const t = map.get(id);
  if (!t) throw new Error(`unknown transform: ${id}`);
  return t;
}

export function listTransforms(): Transform[] {
  return [...map.values()];
}

export function runPipeline(
  text: string,
  steps: Step[],
  ctx?: Partial<RunContext>,
): string {
  const full: RunContext = {
    config: ctx?.config ?? defaultConfig,
    onStep: ctx?.onStep,
  };
  return steps
    .filter((s) => s.enabled !== false)
    .reduce((acc, s, i) => {
      full.onStep?.(s.id, i, steps.length);
      return getTransform(s.id).run(acc, s.args ?? [], full);
    }, text);
}
