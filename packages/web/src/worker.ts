import {
  checkQuotes,
  defaultConfig,
  detectChapters,
  getTransform,
  runCleanup,
  runCleanupEx,
  runTypesetRead,
  runTypesetSplit,
} from '@typeset/core';
import type {
  ChapterEntry,
  PipelineId,
  QuoteIssue,
  RunContext,
  TypesetConfig,
  TypesetSplitOptions,
} from '@typeset/core';

/** 主线程 -> Worker：一次排版任务 */
export interface RunRequest {
  kind: 'run';
  /** 幂等标识，主线程用它匹配回包 */
  jobId: string;
  /** 四条业务 pipeline，或 singleStep（规则面板的单步运行），或 checkQuotes（引号配对检查），或 detectChapters（章节目录） */
  pipeline: PipelineId | 'singleStep' | 'checkQuotes' | 'detectChapters';
  /** 输入文本：postMessage 传 10MB 字符串走结构化克隆即可，不做多余拷贝 */
  text: string;
  /** cleanup 的启用步骤 id；不传 = 按默认开关 */
  enabledIds?: string[];
  /** cleanup 的步骤顺序（id 数组）；不传 = 默认顺序 */
  order?: string[];
  /** typesetSplit 的书籍/标头选项 */
  splitOptions?: TypesetSplitOptions;
  /** singleStep 时指定 transform id */
  stepId?: string;
  /** 引擎配置（linenum 等），不传用默认 */
  config?: Partial<TypesetConfig>;
}

/** Worker -> 主线程 */
export type WorkerOut =
  | { kind: 'progress'; jobId: string; stepId: string; index: number; total: number }
  | { kind: 'done'; jobId: string; result: string }
  | { kind: 'error'; jobId: string; message: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<RunRequest>) => void) | null;
  postMessage: (m: WorkerOut) => void;
};

ctx.onmessage = (e) => {
  const msg = e.data as RunRequest | undefined;
  if (!msg || msg.kind !== 'run') return;
  const post = ctx.postMessage.bind(ctx);
  const progress = (stepId: string, index: number, total: number) =>
    post({ kind: 'progress', jobId: msg.jobId, stepId, index, total });

  try {
    const runCtx: Partial<RunContext> = {
      config: { ...defaultConfig, ...msg.config },
      onStep: (stepId, index, total) => progress(stepId, index, total),
    };

    let result: string;
    switch (msg.pipeline) {
      case 'cleanup':
        result = runCleanup(msg.text, msg.enabledIds, runCtx, msg.order);
        break;
      case 'checkQuotes': {
        progress('checkQuotes', 0, 1);
        const issues: QuoteIssue[] = checkQuotes(msg.text);
        result = JSON.stringify(issues);
        break;
      }
      case 'detectChapters': {
        progress('detectChapters', 0, 1);
        const toc: ChapterEntry[] = detectChapters(msg.text);
        result = JSON.stringify(toc);
        break;
      }
      case 'cleanupEx':
        // 函数式 pipeline，内部不逐步骤报进度：先给一个粗粒度进度
        progress('cleanupEx', 0, 1);
        result = runCleanupEx(msg.text, runCtx);
        break;
      case 'typesetSplit':
        progress('typesetSplit', 0, 1);
        result = runTypesetSplit(msg.text, msg.splitOptions ?? {}, runCtx);
        break;
      case 'typesetRead':
        progress('typesetRead', 0, 1);
        result = runTypesetRead(msg.text, runCtx);
        break;
      case 'singleStep': {
        if (!msg.stepId) throw new Error('singleStep 缺少 stepId');
        const full: RunContext = {
          config: { ...defaultConfig, ...msg.config },
        };
        progress(msg.stepId, 0, 1);
        result = getTransform(msg.stepId).run(msg.text, [], full);
        break;
      }
      default:
        throw new Error(`未知 pipeline：${(msg as RunRequest).pipeline}`);
    }
    post({ kind: 'done', jobId: msg.jobId, result });
  } catch (err) {
    post({
      kind: 'error',
      jobId: msg.jobId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
