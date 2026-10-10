import { diffLines } from 'diff';
import type { Change } from 'diff';

/** 超过该行数时 diff 只渲染改动区域（± 上下文），避免巨型 DOM */
const FULL_RENDER_LINE_LIMIT = 20000;
const HUNK_CONTEXT = 3;

export interface DiffSummary {
  /** 改动处数量（连续的增/删算一处） */
  changeCount: number;
  addedLines: number;
  removedLines: number;
  /** 是否因文本过大只显示改动区域 */
  truncated: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface Row {
  left: string | null; // null = 占位空行
  right: string | null;
  cls: '' | 'del' | 'add' | 'gap';
}
export type { Row };

/**
 * 把 diffLines 的 parts 转成左右对齐的行：
 * 连续的 removed+added 配对成同一行（左删右增），数量不等时补空行。
 */
export function buildRows(changes: Change[]): Row[] {
  const rows: Row[] = [];
  let i = 0;
  while (i < changes.length) {
    const part = changes[i];
    const next = changes[i + 1];
    if (!part.added && !part.removed) {
      // 公共部分
      for (const line of splitLines(part.value)) {
        rows.push({ left: line, right: line, cls: '' });
      }
      i += 1;
    } else if (part.removed && next?.added) {
      // 删+增配对
      const del = splitLines(part.value);
      const add = splitLines(next.value);
      const n = Math.max(del.length, add.length);
      for (let k = 0; k < n; k++) {
        rows.push({
          left: del[k] ?? null,
          right: add[k] ?? null,
          cls: 'del',
        });
      }
      i += 2;
    } else if (part.removed) {
      for (const line of splitLines(part.value)) {
        rows.push({ left: line, right: null, cls: 'del' });
      }
      i += 1;
    } else {
      for (const line of splitLines(part.value)) {
        rows.push({ left: null, right: line, cls: 'add' });
      }
      i += 1;
    }
  }
  return rows;
}

function splitLines(s: string): string[] {
  if (s === '') return [];
  const lines = s.split('\n');
  // diffLines 的 part.value 常以 \n 结尾，去掉末尾空元素
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function summarize(changes: Change[]): Omit<DiffSummary, 'truncated'> {
  let changeCount = 0;
  let addedLines = 0;
  let removedLines = 0;
  let inHunk = false;
  for (const part of changes) {
    const lines = splitLines(part.value).length;
    if (part.added || part.removed) {
      if (!inHunk) {
        changeCount += 1;
        inHunk = true;
      }
      if (part.added) addedLines += lines;
      if (part.removed) removedLines += lines;
    } else {
      inHunk = false;
    }
  }
  return { changeCount, addedLines, removedLines };
}

function rowHtml(text: string | null, sideCls: string): string {
  if (text === null) return `<div class="dline empty ${sideCls}"></div>`;
  const shown = text === '' ? ' ' : esc(text);
  return `<div class="dline ${sideCls}">${shown}</div>`;
}

/**
 * 只保留改动行（cls !== ''），hunk 之间用 ⋯ 分隔。
 */
export function filterChangedOnly(rows: Row[]): Row[] {
  const view: Row[] = [];
  let lastIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cls === '') continue;
    // 与上一个改动行不相邻（中间隔了未改动行）则加 ⋯ 分隔
    if (lastIdx !== -1 && i > lastIdx + 1) {
      view.push({ left: '⋯', right: '⋯', cls: 'gap' });
    }
    view.push(rows[i]);
    lastIdx = i;
  }
  return view;
}

/** 大文本的 hunk 截断：只取改动区域 ± 上下文 */
function truncateHunks(rows: Row[]): Row[] {
  const view: Row[] = [];
  let lastEnd = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cls !== '') {
      const start = Math.max(0, i - HUNK_CONTEXT);
      const end = Math.min(rows.length - 1, i + HUNK_CONTEXT);
      if (start > lastEnd + 1) view.push({ left: '⋯', right: '⋯', cls: 'gap' });
      for (let k = Math.max(start, lastEnd + 1); k <= end; k++) view.push(rows[k]);
      lastEnd = end;
      i = end;
    }
  }
  return view;
}

/** 由 rows 生成左右两列 HTML（不含 diff 计算，可复用缓存的 rows 反复渲染） */
export function renderRows(
  rows: Row[],
  opts?: { changedOnly?: boolean },
): { leftHtml: string; rightHtml: string; truncated: boolean } {
  let view: Row[] = rows;
  let truncated = false;
  if (opts?.changedOnly) {
    view = filterChangedOnly(rows);
  } else if (rows.length > FULL_RENDER_LINE_LIMIT) {
    truncated = true;
    view = truncateHunks(rows);
  }

  const left: string[] = [];
  const right: string[] = [];
  for (const r of view) {
    if (r.cls === 'gap') {
      left.push('<div class="dline gap">⋯</div>');
      right.push('<div class="dline gap">⋯</div>');
      continue;
    }
    // del 行：左删右增（配对）或左删右空；add 行：左空右增；普通行两侧一致
    const leftCls = r.cls === 'del' ? 'del' : r.cls === 'add' ? 'pad' : '';
    const rightCls = r.cls === 'add' ? 'add' : r.cls === 'del' && r.right !== null ? 'add' : r.cls === 'del' ? 'pad' : '';
    left.push(rowHtml(r.left, leftCls));
    right.push(rowHtml(r.right, rightCls));
  }
  return { leftHtml: left.join(''), rightHtml: right.join(''), truncated };
}

/** diff 计算（行级），返回可缓存的 rows 与统计 */
export function diffToRows(
  original: string,
  result: string,
): { rows: Row[]; summary: Omit<DiffSummary, 'truncated'> } {
  const changes = diffLines(original, result);
  return { rows: buildRows(changes), summary: summarize(changes) };
}

/**
 * 渲染左右并排 diff，返回 {leftHtml, rightHtml, summary}。
 * 大文本只取改动 hunk ± 上下文；changedOnly 时只显示改动行。
 */
export function renderDiff(
  original: string,
  result: string,
  opts?: { changedOnly?: boolean },
): { leftHtml: string; rightHtml: string; summary: DiffSummary } {
  const { rows, summary } = diffToRows(original, result);
  const { leftHtml, rightHtml, truncated } = renderRows(rows, opts);
  return { leftHtml, rightHtml, summary: { ...summary, truncated } };
}
