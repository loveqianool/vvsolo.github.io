import { createEditor, type EditorHandle} from './editor';
import { diffToRows, renderRows} from './diff';
import type { Row } from './diff';
import {
BOOK_KEY,
DRAFT_KEY,
RULES_KEY,
RULES_ORDER_KEY,
loadJSON,
removeKey,
saveJSON,
type BookInfo,
} from './store';
import {
PIPELINE_STEPS,
getTransform,
type ChapterEntry,
type LongParaIssue,
type PipelineId,
type QuoteIssue,
} from '@typeset/core';
import type { RunRequest, WorkerOut} from './worker';

const PIPELINE_LABEL: Record<PipelineId, string> = {
cleanup: '一键整理',
cleanupEx: '特殊整理',
typesetSplit: '分段排版',
typesetRead: '阅读排版',
};

/** Init/End 恒启用，不可关闭 */
const LOCKED_STEPS = new Set(['Init', 'End']);
const CLEANUP_IDS = PIPELINE_STEPS.cleanup.map((s) => s.id);
const TOGGLEABLE_IDS = CLEANUP_IDS.filter((id) =>!LOCKED_STEPS.has(id));
/** 默认启用的规则（defaultEnabled === false 的新规则默认关闭） */
const DEFAULT_ENABLED_IDS = PIPELINE_STEPS.cleanup
.filter((s) => s.defaultEnabled !== false)
.map((s) => s.id);

const DEFAULT_BOOK: BookInfo = {
bookName: '',
chapter: '',
author: '',
site: '',
isFirst: false,
addHeader: false,
};

function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
let timer: ReturnType<typeof setTimeout> | undefined;
return (...args: T) => {
clearTimeout(timer);
timer = setTimeout(() => fn(...args), ms);
};
}

function fmtTime(d: Date): string {
return d.toTimeString().slice(0, 5);
}


function newJobId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function initUI(root: HTMLElement): void {
const book = {...DEFAULT_BOOK,...loadJSON<Partial<BookInfo>>(BOOK_KEY, {})};
let enabledIds = loadJSON<string[]>(RULES_KEY, DEFAULT_ENABLED_IDS);
// 兼容旧数据：过滤掉未知 id（新增的默认关闭规则保持关闭）
enabledIds = CLEANUP_IDS.filter((id) => enabledIds.includes(id));

/** 规则显示/执行顺序（用户可调，持久化） */
let ruleOrder = loadJSON<string[]>(RULES_ORDER_KEY, CLEANUP_IDS);
// 清理未知 id，新增规则补到末尾
ruleOrder = [
...ruleOrder.filter((id) => CLEANUP_IDS.includes(id)),
...CLEANUP_IDS.filter((id) =>!ruleOrder.includes(id)),
];
const persistOrder = () => saveJSON(RULES_ORDER_KEY, ruleOrder);

root.innerHTML = `
<header class="topbar">
<button class="icon-btn" id="btn-sidebar" title="收起/展开侧边栏">☰</button>
<div class="brand"><span class="logo">✒</span><h1>小说排版助手</h1></div>
<nav class="pipelines" aria-label="排版流程">
<button class="btn primary" data-pipeline="cleanup" title="快捷键 F8">一键整理</button>
<button class="btn" data-pipeline="cleanupEx" title="快捷键 F7">特殊整理</button>
<button class="btn" data-pipeline="typesetSplit" title="快捷键 F9">分段排版</button>
<button class="btn" data-pipeline="typesetRead">阅读排版</button>
</nav>
<div class="top-actions">
<button class="btn ghost" id="btn-toc">查看目录</button>
<button class="btn ghost" id="btn-quote-check">引号检查</button>
<button class="btn ghost" id="btn-longpara-check" title="找出超过 300 字的段落">长段落检查</button>
<button class="btn ghost" id="btn-search" title="快捷键 Ctrl+F">查找替换</button>
</div>
</header>
<div class="docbar" aria-label="文档操作">
<button class="chip" id="btn-new">新建</button>
<button class="chip" id="btn-save">保存草稿</button>
<button class="chip" id="btn-restore">还原草稿</button>
<button class="chip danger" id="btn-clear">清空</button>
<button class="chip" id="btn-fold">折叠章节</button>
<span class="spacer"></span>
<button class="chip" id="btn-rediff" hidden>查看上次 diff</button>
</div>
<div class="main">
<aside class="sidebar" id="sidebar">
<section class="panel">
<h2>书籍信息</h2>
<div class="title-preview" id="title-preview"></div>
<label class="field"><span>书名</span><input id="book-name" placeholder="小说名称" maxlength="80"></label>
<label class="field"><span>章节</span><input id="book-chapter" placeholder="更新章节" maxlength="80"></label>
<label class="field"><span>作者</span><input id="book-author" placeholder="作者名称" maxlength="40"></label>
<label class="field"><span>首发</span><input id="book-site" placeholder="首发站点" maxlength="40"></label>
<label class="check"><input type="checkbox" id="book-first"> 是否首发</label>
<label class="check"><input type="checkbox" id="book-header"> 添加标头</label>
</section>
<section class="panel">
<h2>整理规则 <button class="link" id="btn-rules-reset">重置</button></h2>
<p class="hint">「一键整理」启用的步骤，Init / End 恒启用；点击规则名可单步运行；↑↓ 可调顺序</p>
<ul class="rules" id="rules-list"></ul>
<div class="rules-io">
<button class="chip" id="btn-rules-export">导出 JSON</button>
<button class="chip" id="btn-rules-import">导入 JSON</button>
<input type="file" id="rules-file" accept="application/json,.json" hidden>
</div>
<div class="quote-results" id="quote-results" hidden></div>
</section>
</aside>
<main class="editor-pane"><div id="editor"></div></main>
</div>
<footer class="statusbar">
<span id="status-text">就绪</span>
<div class="progress" id="progress" hidden>
<div class="track"><div class="bar" id="progress-bar"></div></div>
<span id="progress-label"></span>
</div>
<span class="spacer"></span>
<span id="draft-info"></span>
<span id="char-count">0 字</span>
</footer>
<div class="diff-overlay" id="diff-overlay" hidden>
<div class="diff-modal" role="dialog" aria-label="排版结果预览">
<header>
<h2 id="diff-title">排版预览</h2>
<span class="diff-summary" id="diff-summary"></span>
<label class="diff-toggle"><input type="checkbox" id="diff-changed-only">只看改动</label>
<span class="spacer"></span>
<button class="btn primary" id="diff-apply">应用结果</button>
<button class="btn" id="diff-discard">放弃</button>
<button class="icon-btn" id="diff-close" title="关闭">✕</button>
</header>
<div class="diff-body">
<div class="diff-col"><h3>原文</h3><div class="diff-lines" id="diff-left"></div></div>
<div class="diff-col"><h3>结果</h3><div class="diff-lines" id="diff-right"></div></div>
</div>
</div>
</div>
<div class="toc-overlay" id="toc-overlay" hidden>
<div class="toc-modal" role="dialog" aria-label="章节目录">
<header>
<h2 id="toc-title">章节目录</h2>
<span class="spacer"></span>
<button class="icon-btn" id="toc-close" title="关闭">✕</button>
</header>
<div class="toc-body"><ul id="toc-list"></ul></div>
</div>
</div>
<div class="page-nav" aria-label="文档跳转">
<button id="btn-goto-top" title="回到文档顶部">↑</button>
<button id="btn-goto-bottom" title="跳到文档底部">↓</button>
</div>`;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
root.querySelector<T>(sel)!;

/* ---------------- 编辑器 ---------------- */
const charCount = $('#char-count');
const draftInfo = $('#draft-info');
const statusText = $('#status-text');
const setStatus = (s: string) => {
statusText.textContent = s;
};

const persistDraft = (text: string) => {
saveJSON(DRAFT_KEY, text);
draftInfo.textContent = `草稿已保存 ${fmtTime(new Date())}`;
};
const persistDraftDebounced = debounce(persistDraft, 2000);

/* ---------------- Worker（提前创建，供统计用） ---------------- */
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
type: 'module',
});

/* ---------------- 全文统计：字数（即时）+ 章节数（worker 防抖） ---------------- */
let lastCharCount = 0;
let lastChapterCount: number | null = null;
let statsJob: string | null = null;
let statsSeq = 0;
function renderStats() {
charCount.textContent =
lastChapterCount === null
? `${lastCharCount.toLocaleString()} 字`
: `${lastCharCount.toLocaleString()} 字 · ${lastChapterCount} 章`;
}
function refreshStats(text: string) {
if (!text) {
lastChapterCount = null;
renderStats();
return;
}
statsSeq += 1;
statsJob = `stats-${statsSeq}`;
const req: RunRequest = { kind: 'run', jobId: statsJob, pipeline: 'detectChapters', text};
worker.postMessage(req);
}
const refreshStatsDebounced = debounce(refreshStats, 1200);

const editor: EditorHandle = createEditor($('#editor'), {
initialValue: loadJSON<string>(DRAFT_KEY, ''),
onChange: (text) => {
lastCharCount = text.length;
renderStats();
persistDraftDebounced(text);
refreshStatsDebounced(text);
},
});
lastCharCount = editor.getValue().length;
renderStats();
if (editor.getValue()) {
draftInfo.textContent = '已载入本地草稿';
refreshStatsDebounced(editor.getValue());
}

/* ---------------- Worker 状态 ---------------- */
let currentJob: string | null = null;
let convertDir: 's2t' | 't2s' = 's2t';
const pipelineBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-pipeline]')];
const progress = $('#progress');
const progressBar = $('#progress-bar');
const progressLabel = $('#progress-label');

const setRunning = (running: boolean) => {
pipelineBtns.forEach((b) => {
b.disabled = running;
});
progress.hidden =!running;
if (!running) progressBar.classList.remove('indeterminate');
};

const stepTitle = (id: string): string => {
try {
return getTransform(id).title || id;
} catch {
return PIPELINE_LABEL[id as PipelineId] || id;
}
};

interface LastDiff {
original: string;
result: string;
label: string;
}
let lastDiff: LastDiff | null = null;
let lastRows: Row[] | null = null;
let lastBaseSummary: { changeCount: number; addedLines: number; removedLines: number } | null = null;
const diffOverlay = $('#diff-overlay');
const btnRediff = $('#btn-rediff');
const chkChangedOnly = $('#diff-changed-only') as HTMLInputElement;

function refreshDiffView() {
if (!lastRows || !lastBaseSummary) return;
const changedOnly = chkChangedOnly.checked;
const { leftHtml, rightHtml, truncated } = renderRows(lastRows, { changedOnly });
$('#diff-left').innerHTML = leftHtml;
$('#diff-right').innerHTML = rightHtml;
$('#diff-left').scrollTop = 0;
$('#diff-right').scrollTop = 0;
const parts = [
`共 ${lastBaseSummary.changeCount} 处改动`,
`+${lastBaseSummary.addedLines} 行`,
`−${lastBaseSummary.removedLines} 行`,
];
if (changedOnly) parts.push('（仅显示改动行）');
else if (truncated) parts.push('（文本过大，仅显示改动区域）');
if (lastBaseSummary.changeCount === 0) parts.push('（文本无变化）');
$('#diff-summary').textContent = parts.join(' ');
}

function openDiff(d: LastDiff) {
lastDiff = d;
$('#diff-title').textContent = `${d.label} · 预览`;
const { rows, summary } = diffToRows(d.original, d.result);
lastRows = rows;
lastBaseSummary = summary;
chkChangedOnly.checked = false;
refreshDiffView();
diffOverlay.hidden = false;
btnRediff.hidden = false;
}
chkChangedOnly.addEventListener('change', refreshDiffView);
const closeDiff = () => {
diffOverlay.hidden = true;
};

// diff 两列滚动同步
const diffLeft = $('#diff-left');
const diffRight = $('#diff-right');
let syncing = false;
const syncScroll = (src: HTMLElement, dst: HTMLElement) => () => {
if (syncing) return;
syncing = true;
dst.scrollTop = src.scrollTop;
syncing = false;
};
diffLeft.addEventListener('scroll', syncScroll(diffLeft, diffRight));
diffRight.addEventListener('scroll', syncScroll(diffRight, diffLeft));

worker.onmessage = (e: MessageEvent<WorkerOut>) => {
const msg = e.data;
// 统计任务走独立通道，不占用 currentJob
if (typeof msg.jobId === 'string' && msg.jobId.startsWith('stats-')) {
if (msg.kind === 'done' && msg.jobId === statsJob) {
try {
const toc = JSON.parse(msg.result) as ChapterEntry[];
lastChapterCount = toc.length;
} catch {
lastChapterCount = null;
}
statsJob = null;
renderStats();
}
return;
}
if (msg.jobId!== currentJob) return; // 过期任务回包直接丢弃
if (msg.kind === 'progress') {
if (msg.total <= 1) {
progressBar.classList.add('indeterminate');
progressBar.style.width = '100%';
progressLabel.textContent = stepTitle(msg.stepId);
} else {
progressBar.classList.remove('indeterminate');
const pct = Math.round(((msg.index + 1) / msg.total) * 100);
progressBar.style.width = `${pct}%`;
progressLabel.textContent = `${msg.index + 1}/${msg.total} · ${stepTitle(msg.stepId)}`;
}
setStatus(`运行中… ${progressLabel.textContent}`);
} else if (msg.kind === 'done') {
const label = (msg as { label?: string}).label || currentLabel;
setRunning(false);
currentJob = null;
if (currentPipeline === 'checkQuotes') {
try {
showQuoteResults(JSON.parse(msg.result) as QuoteIssue[]);
setStatus('引号检查完成');
} catch {
setStatus('引号检查结果解析失败');
}
} else if (currentPipeline === 'detectChapters') {
if (foldPending) {
foldPending = false;
foldChapterBodies(JSON.parse(msg.result) as ChapterEntry[]);
setStatus('章节已折叠，点击 … 可单独展开');
} else {
try {
openToc(JSON.parse(msg.result) as ChapterEntry[]);
setStatus('目录已生成');
} catch {
setStatus('目录结果解析失败');
}
}
} else if (currentPipeline === 'checkLongParas') {
try {
showLongParaResults(JSON.parse(msg.result) as LongParaIssue[]);
setStatus('长段落检查完成');
} catch {
setStatus('长段落检查结果解析失败');
}
} else {
setStatus('完成，等待预览确认');
openDiff({ original: lastInput, result: msg.result, label});
}
currentPipeline = '';
} else {
setRunning(false);
currentJob = null;
setStatus(`出错：${msg.message}`);
}
};
worker.onerror = (e) => {
setRunning(false);
currentJob = null;
setStatus(`Worker 错误：${e.message}`);
};

let currentLabel = '';
let lastInput = '';
/** 当前任务的 pipeline（用于区分 checkQuotes 的结果展示） */
let currentPipeline: string = '';

/** 引号配对检查：只读，不修改文本，结果列在规则面板下方 */
function runQuoteCheck() {
if (currentJob) {
setStatus('有任务正在运行，请稍候…');
return;
}
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，先粘贴文本');
editor.focus();
return;
}
const req: RunRequest = { kind: 'run', jobId: newJobId(), pipeline: 'checkQuotes', text};
currentJob = req.jobId;
currentLabel = '引号配对检查';
currentPipeline = 'checkQuotes';
setRunning(true);
progressBar.style.width = '0%';
progressBar.classList.add('indeterminate');
progressLabel.textContent = currentLabel;
setStatus(`开始：${currentLabel}…`);
worker.postMessage(req);
}

const quoteResults = $('#quote-results');
const showQuoteResults = (issues: QuoteIssue[]) => {
quoteResults.hidden = false;
if (issues.length === 0) {
quoteResults.innerHTML = '<p class="quote-ok">引号全部配对，没有发现可疑行。</p>';
return;
}
quoteResults.innerHTML =
`<p class="quote-head">发现 ${issues.length} 行引号可疑（点击行号跳到该行）：</p><ul>` +
issues
.map(
(x) =>
`<li><button class="link" data-goto="${x.line}">第 ${x.line} 行</button>` +
`<span class="quote-detail">${escapeHtml(x.detail)}</span>` +
`<div class="quote-text">${escapeHtml(x.text)}</div></li>`,
)
.join('') +
'</ul>';
};
quoteResults.addEventListener('click', (e) => {
const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-goto]');
if (!btn) return;
editor.gotoLine(Number(btn.dataset.goto));
});
$('#btn-quote-check').addEventListener('click', runQuoteCheck);

/* ---------------- 长段落检查（>300 字，只读） ---------------- */
const showLongParaResults = (issues: LongParaIssue[]) => {
const el = $('#quote-results');
el.hidden = false;
if (issues.length === 0) {
el.innerHTML = '<p class="quote-ok">没有超过 300 字的段落。</p>';
return;
}
el.innerHTML =
`<p class="quote-head">发现 ${issues.length} 个超长段落（点击行号跳到该行）：</p><ul>` +
issues
.map(
(x) =>
`<li><button class="link" data-goto="${x.line}">第 ${x.line} 行</button>` +
`<span class="quote-detail">${x.length} 字</span>` +
`<div class="quote-text">${escapeHtml(x.preview)}</div></li>`,
)
.join('') +
'</ul>';
};
function runLongParaCheck() {
if (currentJob) {
setStatus('有任务正在运行，请稍候…');
return;
}
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，先粘贴文本');
editor.focus();
return;
}
const req: RunRequest = { kind: 'run', jobId: newJobId(), pipeline: 'checkLongParas', text};
currentJob = req.jobId;
currentLabel = '长段落检查';
currentPipeline = 'checkLongParas';
setRunning(true);
progressBar.style.width = '0%';
progressBar.classList.add('indeterminate');
progressLabel.textContent = currentLabel;
setStatus(`开始：${currentLabel}…`);
worker.postMessage(req);
}
$('#btn-longpara-check').addEventListener('click', runLongParaCheck);
$('#btn-search').addEventListener('click', () => editor.openSearch());

/* ---------------- 章节目录 ---------------- */
const tocOverlay = $('#toc-overlay');
const tocList = $('#toc-list');
const tocTitle = $('#toc-title');
const openToc = (toc: ChapterEntry[]) => {
tocTitle.textContent = `章节目录（${toc.length} 章）`;
tocList.innerHTML =
toc.length === 0
? '<li class="toc-empty">未识别到章节标题</li>'
: toc
.map(
(x) =>
`<li><button class="link toc-item" data-goto="${x.line}">` +
`${escapeHtml(x.title)}</button></li>`,
)
.join('');
tocOverlay.hidden = false;
};
const closeToc = () => {
tocOverlay.hidden = true;
};
$('#toc-close').addEventListener('click', closeToc);
tocOverlay.addEventListener('click', (e) => {
if (e.target === tocOverlay) closeToc();
});
tocList.addEventListener('click', (e) => {
const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-goto]');
if (!btn) return;
closeToc();
editor.gotoLine(Number(btn.dataset.goto));
});
function runToc() {
if (currentJob) {
setStatus('有任务正在运行，请稍候…');
return;
}
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，先粘贴文本');
editor.focus();
return;
}
const req: RunRequest = { kind: 'run', jobId: newJobId(), pipeline: 'detectChapters', text};
currentJob = req.jobId;
currentLabel = '章节目录';
currentPipeline = 'detectChapters';
setRunning(true);
progressBar.style.width = '0%';
progressBar.classList.add('indeterminate');
progressLabel.textContent = currentLabel;
setStatus(`开始：${currentLabel}…`);
worker.postMessage(req);
}
$('#btn-toc').addEventListener('click', runToc);

/* ---------------- 章节折叠 ---------------- */
let foldPending = false;
const btnFold = $('#btn-fold') as HTMLButtonElement;
function foldChapterBodies(toc: ChapterEntry[]) {
if (toc.length === 0) {
setStatus('未识别到章节，无可折叠内容');
return;
}
const totalLines = editor.lineCount();
const docLen = editor.docLength();
const ranges: Array<{ from: number; to: number }> = [];
for (let i = 0; i < toc.length; i++) {
const from = editor.lineRange(toc[i].line).to; // 标题行末（含换行）
const nextLine = i + 1 < toc.length ? toc[i + 1].line : totalLines + 1;
const to = nextLine <= totalLines ? editor.lineRange(nextLine).from : docLen;
if (to > from) ranges.push({ from, to });
}
const n = editor.foldRanges(ranges);
if (n > 0) {
btnFold.textContent = '展开章节';
setStatus(`已折叠 ${n} 个章节正文，点击 … 可单独展开`);
} else {
setStatus('章节下无正文可折叠');
}
}
btnFold.addEventListener('click', () => {
if (editor.isFolded()) {
editor.unfoldAll();
btnFold.textContent = '折叠章节';
setStatus('已展开全部章节');
return;
}
if (currentJob) {
setStatus('有任务正在运行，请稍候…');
return;
}
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，先粘贴文本');
editor.focus();
return;
}
foldPending = true;
const req: RunRequest = { kind: 'run', jobId: newJobId(), pipeline: 'detectChapters', text};
currentJob = req.jobId;
currentLabel = '章节折叠';
currentPipeline = 'detectChapters';
setRunning(true);
progressBar.style.width = '0%';
progressBar.classList.add('indeterminate');
progressLabel.textContent = currentLabel;
setStatus(`开始：${currentLabel}…`);
worker.postMessage(req);
});

/* ---------------- 右下角文档跳转 ---------------- */
$('#btn-goto-top').addEventListener('click', () => editor.gotoLine(1));
$('#btn-goto-bottom').addEventListener('click', () =>
editor.gotoLine(Number.MAX_SAFE_INTEGER),
);

function runPipeline(pipeline: PipelineId | 'singleStep', stepId?: string) {
if (currentJob) {
setStatus('有任务正在运行，请稍候…');
return;
}
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，先粘贴文本');
editor.focus();
return;
}
const label =
pipeline === 'singleStep'? `单步：${stepTitle(stepId!)}`: PIPELINE_LABEL[pipeline];
const req: RunRequest = { kind: 'run', jobId: newJobId(), pipeline, text};
if (pipeline === 'cleanup') {
req.enabledIds = enabledIds;
req.order = ruleOrder;
}
if (pipeline === 'typesetSplit') {
req.splitOptions = {
author: book.author.trim(),
site: book.site.trim(),
isFirst: book.isFirst,
addHeader: book.addHeader,
};
}
if (pipeline === 'singleStep') req.stepId = stepId;

currentJob = req.jobId;
currentLabel = label;
currentPipeline = pipeline;
lastInput = text;
setRunning(true);
progressBar.style.width = '0%';
progressBar.classList.add('indeterminate');
progressLabel.textContent = label;
setStatus(`开始：${label}…`);
worker.postMessage(req);
}

pipelineBtns.forEach((btn) => {
btn.addEventListener('click', () => {
runPipeline(btn.dataset.pipeline as PipelineId);
});
});

/* ---------------- 书籍信息 ---------------- */
const titlePreview = $('#title-preview');
const bookInputs = {
bookName: $('#book-name') as HTMLInputElement,
chapter: $('#book-chapter') as HTMLInputElement,
author: $('#book-author') as HTMLInputElement,
site: $('#book-site') as HTMLInputElement,
isFirst: $('#book-first') as HTMLInputElement,
addHeader: $('#book-header') as HTMLInputElement,
};
bookInputs.bookName.value = book.bookName;
bookInputs.chapter.value = book.chapter;
bookInputs.author.value = book.author;
bookInputs.site.value = book.site;
bookInputs.isFirst.checked = book.isFirst;
bookInputs.addHeader.checked = book.addHeader;

const persistBook = debounce(() => saveJSON(BOOK_KEY, book), 500);
const refreshTitle = () => {
const stripEdge = (s: string) => s.replace(/^[（【“「<]|[）】”」>]$/g, '');
const name = stripEdge(book.bookName.trim());
const chap = stripEdge(book.chapter.trim());
const t = (name ? `【${name}】` : '') + (chap ? `（${chap}）` : '');
titlePreview.textContent = t;
titlePreview.classList.toggle('empty',!book.bookName &&!book.chapter);
};
(Object.keys(bookInputs) as (keyof typeof bookInputs)[]).forEach((key) => {
const el = bookInputs[key];
el.addEventListener('input', () => {
if (key === 'isFirst' || key === 'addHeader') {
book[key] = (el as HTMLInputElement).checked;
} else {
book[key] = (el as HTMLInputElement).value;
}
refreshTitle();
persistBook();
});
});
refreshTitle();

/* ---------------- 规则面板 ---------------- */
const rulesList = $('#rules-list');
const renderRules = () => {
rulesList.innerHTML = ruleOrder.map((id, idx) => {
let title = id;
let desc = '';
try {
const t = getTransform(id);
title = t.title || id;
desc = t.description || '';
} catch {
/* 未知 id：保留展示 */
}
const locked = LOCKED_STEPS.has(id);
const checked = locked || enabledIds.includes(id);
const isNewOptIn = !locked &&!DEFAULT_ENABLED_IDS.includes(id);
return `<li class="rule${locked? ' locked': ''}">
<label class="rule-check">
<input type="checkbox" data-rule="${id}" ${checked? 'checked': ''} ${locked? 'disabled': ''}>
</label>
<div class="rule-meta">
<div class="rule-title"><button class="link rule-name" data-run-step="${id}" title="点击单步运行此规则">${escapeHtml(title)}</button>
${locked? '<span class="tag">恒启用</span>': ''}
${isNewOptIn? '<span class="tag tag-opt">默认关闭</span>': ''}
<span class="rule-move">
<button class="link" data-move="-1" data-rule="${id}" ${idx === 0? 'disabled': ''} title="上移">↑</button>
<button class="link" data-move="1" data-rule="${id}" ${idx === ruleOrder.length - 1? 'disabled': ''} title="下移">↓</button>
</span>
</div>
${desc? `<div class="rule-desc">${escapeHtml(desc)}</div>`: ''}
</div>
</li>`;
}).join('') +
`<li class="rule"><div class="rule-meta">` +
`<div class="rule-title"><button class="link rule-name" data-run-step="__convert" title="点击单步运行">简繁转换</button><span class="tag tag-opt">手动</span></div>` +
`<div class="rule-desc">简繁互转：点一次转繁体，再点一次转回简体；只处理编辑器文本，不进入一键整理</div>` +
`</div></li>`;
};
const escapeHtml = (s: string) =>
s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
renderRules();

rulesList.addEventListener('change', (e) => {
const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-rule]');
if (!input) return;
const id = input.dataset.rule!;
enabledIds = input.checked
? [...new Set([...enabledIds, id])]
: enabledIds.filter((x) => x!== id);
saveJSON(RULES_KEY, enabledIds);
setStatus(`规则已更新：${enabledIds.length}/${CLEANUP_IDS.length} 步启用`);
});
rulesList.addEventListener('click', (e) => {
const moveBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-move]');
if (moveBtn &&!moveBtn.disabled) {
const id = moveBtn.dataset.rule!;
const delta = Number(moveBtn.dataset.move);
const idx = ruleOrder.indexOf(id);
const j = idx + delta;
if (idx >= 0 && j >= 0 && j < ruleOrder.length) {
[ruleOrder[idx], ruleOrder[j]] = [ruleOrder[j], ruleOrder[idx]];
persistOrder();
renderRules();
setStatus('规则顺序已更新');
}
return;
}
const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-run-step]');
if (!btn) return;
if (btn.dataset.runStep === '__convert') {
runConvert();
return;
}
runPipeline('singleStep', btn.dataset.runStep!);
});

$('#btn-rules-reset').addEventListener('click', () => {
enabledIds = [...DEFAULT_ENABLED_IDS];
ruleOrder = [...CLEANUP_IDS];
saveJSON(RULES_KEY, enabledIds);
persistOrder();
renderRules();
setStatus('规则已重置为默认');
});
$('#btn-rules-export').addEventListener('click', () => {
const blob = new Blob([JSON.stringify({ version: 2, enabledIds, order: ruleOrder}, null, 2)], {
type: 'application/json',
});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'typeset-rules.json';
a.click();
setTimeout(() => URL.revokeObjectURL(a.href), 5000);
setStatus('规则已导出');
});
$('#btn-rules-import').addEventListener('click', () => {
($('#rules-file') as HTMLInputElement).click();
});
($('#rules-file') as HTMLInputElement).addEventListener('change', (e) => {
const file = (e.target as HTMLInputElement).files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
try {
const data = JSON.parse(String(reader.result));
const ids: string[] = Array.isArray(data)? data: data.enabledIds;
if (!Array.isArray(ids)) throw new Error('格式错误');
const valid = ids.filter((id) => TOGGLEABLE_IDS.includes(id));
enabledIds = [...LOCKED_STEPS,...valid].filter((id) => CLEANUP_IDS.includes(id));
saveJSON(RULES_KEY, enabledIds);
// 顺序：v2 格式带 order，老格式/数组格式沿用默认顺序
const rawOrder: unknown = !Array.isArray(data)? data.order: undefined;
if (Array.isArray(rawOrder)) {
const wanted = (rawOrder as string[]).filter((id) => CLEANUP_IDS.includes(id));
ruleOrder = [
...wanted,
...CLEANUP_IDS.filter((id) =>!wanted.includes(id)),
];
persistOrder();
}
renderRules();
setStatus(`已导入规则：${valid.length} 步启用`);
} catch {
setStatus('导入失败：JSON 格式不正确');
}
};
reader.readAsText(file);
(e.target as HTMLInputElement).value = '';
});

/* ---------------- 文档操作 ---------------- */
$('#btn-new').addEventListener('click', () => {
editor.setValue('');
editor.focus();
setStatus('已新建空白文档（草稿仍在，可还原）');
});
$('#btn-save').addEventListener('click', () => {
persistDraft(editor.getValue());
setStatus('草稿已手动保存');
editor.focus();
});
$('#btn-restore').addEventListener('click', () => {
const draft = loadJSON<string | null>(DRAFT_KEY, null);
if (draft == null || draft === '') {
setStatus('没有可还原的草稿');
return;
}
editor.setValue(draft);
editor.focus();
setStatus('已还原草稿');
});
$('#btn-clear').addEventListener('click', () => {
editor.setValue('');
removeKey(DRAFT_KEY);
draftInfo.textContent = '';
editor.focus();
setStatus('已清空文档与草稿');
});

/* ---------------- 简繁转换（整理规则面板里的单步运行项） ---------------- */
async function runConvert() {
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，无可转换内容');
return;
}
setStatus('正在加载转换词典…');
try {
const { Converter} = await import('opencc-js');
const convert =
convertDir === 's2t'
? Converter({ from: 'cn', to: 'tw'})
: Converter({ from: 'tw', to: 'cn'});
editor.setValue(convert(text));
const done = convertDir === 's2t'? '已转为繁体': '已转为简体';
convertDir = convertDir === 's2t'? 't2s': 's2t';
setStatus(`${done}（再点一次可转回）`);
} catch (err) {
setStatus(`转换失败：${err instanceof Error? err.message: String(err)}`);
} finally {
editor.focus();
}
}

/* ---------------- diff 按钮 ---------------- */
$('#diff-apply').addEventListener('click', () => {
if (!lastDiff) return;
editor.setValue(lastDiff.result);
closeDiff();
setStatus('已应用排版结果');
editor.focus();
});
$('#diff-discard').addEventListener('click', () => {
closeDiff();
setStatus('已放弃本次结果，原文未动');
editor.focus();
});
$('#diff-close').addEventListener('click', () => {
closeDiff();
editor.focus();
});
diffOverlay.addEventListener('click', (e) => {
if (e.target === diffOverlay) closeDiff();
});
btnRediff.addEventListener('click', () => {
if (lastDiff) openDiff(lastDiff);
});

/* ---------------- 侧边栏 ---------------- */
const sidebar = $('#sidebar');
$('#btn-sidebar').addEventListener('click', () => {
root.classList.toggle('sidebar-collapsed');
// 移动端抽屉：点击遮罩外关闭（用 main 点击代理）
});
$('.main').addEventListener('click', (e) => {
if (
window.innerWidth <= 900 &&
!root.classList.contains('sidebar-collapsed') &&
!(e.target as HTMLElement).closest('.sidebar') &&
!(e.target as HTMLElement).closest('#btn-sidebar')
) {
root.classList.add('sidebar-collapsed');
}
});

/* ---------------- 快捷键 ---------------- */
window.addEventListener('keydown', (e) => {
if (e.key === 'F7') {
e.preventDefault();
runPipeline('cleanupEx');
} else if (e.key === 'F8') {
e.preventDefault();
runPipeline('cleanup');
} else if (e.key === 'F9') {
e.preventDefault();
runPipeline('typesetSplit');
} else if (e.key === 'Escape' &&!diffOverlay.hidden) {
closeDiff();
}
});

editor.focus();
}
