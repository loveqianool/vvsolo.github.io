/** web 包冒烟测试：worker 协议 + diff 渲染（跑在 vite pipeline 下，import.meta.glob 可用） */
import { describe, expect, it } from 'vitest';

// ---- stub self，再导入 worker ----
const sent: any[] = [];
let onmessage: ((e: any) => void) | null = null;
(globalThis as any).self = {
  set onmessage(fn: any) { onmessage = fn; },
  get onmessage() { return onmessage; },
  postMessage: (m: any) => { sent.push(m); },
};

const workerMod = await import('../../web/src/worker.ts');
expect(workerMod).toBeTruthy();
const { renderDiff } = await import('../../web/src/diff.ts');

const sample = '第一章 测试\n\nhello,world!  这是“测试”文本。。。\n\n＊＊＊\n\n第二章  开始\n正文内容。\n';

function run(job: any) {
  sent.length = 0;
  onmessage!({ data: job });
  return [...sent];
}

describe('worker 协议', () => {
  it('cleanup 全开：progress + done', () => {
    const msgs = run({ kind: 'run', jobId: 'j1', pipeline: 'cleanup', text: sample });
    const kinds = msgs.map((m) => m.kind);
    expect(kinds[0]).toBe('progress');
    expect(kinds[kinds.length - 1]).toBe('done');
    const done = msgs.find((m) => m.kind === 'done');
    expect(done.jobId).toBe('j1');
    expect(typeof done.result).toBe('string');
    expect(done.result.length).toBeGreaterThan(0);
    // progress 步骤名应为 transform id
    expect(msgs[0]).toMatchObject({ stepId: 'Init' });
  });

  it('cleanup 部分启用', () => {
    const msgs = run({ kind: 'run', jobId: 'j2', pipeline: 'cleanup', text: sample, enabledIds: ['Init', 'Punctuation', 'End'] });
    const progs = msgs.filter((m) => m.kind === 'progress');
    expect(progs.map((m) => m.stepId)).toEqual(['Init', 'Punctuation', 'End']);
    expect(msgs.at(-1).kind).toBe('done');
  });

  it('cleanupEx / typesetSplit / typesetRead', () => {
    for (const [jobId, pipeline, extra] of [
      ['j3', 'cleanupEx', {}],
      ['j4', 'typesetSplit', { splitOptions: { author: '作者', site: '起点', isFirst: true, addHeader: true } }],
      ['j5', 'typesetRead', {}],
    ] as const) {
      const msgs = run({ kind: 'run', jobId, pipeline, text: sample, ...extra });
      const done = msgs.find((m) => m.kind === 'done');
      expect(done, pipeline).toBeTruthy();
      expect(done.result.length).toBeGreaterThan(0);
    }
    // typesetSplit 应包含标头
    const split = run({ kind: 'run', jobId: 'j4b', pipeline: 'typesetSplit', text: sample, splitOptions: { author: '作者', site: '起点', isFirst: false, addHeader: true } }).find((m) => m.kind === 'done');
    expect(split.result).toContain('作者：作者');
    expect(split.result).toContain('是否首发：否');
  });

  it('singleStep 单步运行', () => {
    const msgs = run({ kind: 'run', jobId: 'j6', pipeline: 'singleStep', text: sample, stepId: 'Punctuation' });
    expect(msgs.at(-1).kind).toBe('done');
  });

  it('未知 step 走 error 通道不崩', () => {
    const msgs = run({ kind: 'run', jobId: 'j7', pipeline: 'singleStep', text: sample, stepId: 'NoSuchStep' });
    const err = msgs.find((m) => m.kind === 'error');
    expect(err).toBeTruthy();
    expect(err.jobId).toBe('j7');
    expect(err.message).toContain('unknown transform');
  });

  it('非 run 消息被忽略', () => {
    const msgs = run({ kind: 'ping' });
    expect(msgs).toEqual([]);
  });
});

describe('diff 渲染', () => {
  it('行级 diff：改动计数与高亮', () => {
    const a = '第一行\n第二行，标点,混乱\n第三行\n';
    const b = '第一行\n第二行，标点，混乱\n第三行\n第四行新增\n';
    const { leftHtml, rightHtml, summary } = renderDiff(a, b);
    expect(summary.changeCount).toBe(2); // 一处修改 + 一处新增
    expect(summary.addedLines).toBe(2);
    expect(summary.removedLines).toBe(1);
    expect(leftHtml).toContain('dline del');
    expect(rightHtml).toContain('dline add');
    expect(leftHtml).toContain('dline empty pad'); // 新增行左侧占位
    // HTML 转义
    const x = renderDiff('<b>旧</b>\n', '<i>新</i>\n');
    expect(x.leftHtml).toContain('&lt;b&gt;');
    expect(x.leftHtml).not.toContain('<b>');
  });

  it('无变化时 changeCount 为 0', () => {
    const { summary } = renderDiff('abc\n', 'abc\n');
    expect(summary.changeCount).toBe(0);
  });

  it('大文本只渲染改动区域', () => {
    const big = Array.from({ length: 30000 }, (_, i) => `第${i}行正文内容`).join('\n');
    const big2 = big.replace('第15000行正文内容', '第15000行被修改');
    const { summary } = renderDiff(big, big2);
    expect(summary.truncated).toBe(true);
    expect(summary.changeCount).toBe(1);
  });
});
