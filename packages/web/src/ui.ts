import { createEditor, type EditorHandle} from './editor';
import { renderDiff} from './diff';
import {
BOOK_KEY,
DRAFT_KEY,
RULES_KEY,
loadJSON,
removeKey,
saveJSON,
type BookInfo,
} from './store';
import {
PIPELINE_STEPS,
getTransform,
type PipelineId,
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

const DEFAULT_BOOK: BookInfo = {
bookName: '',
chapter: '',
author: '',
site: '',
isFirst: true,
addHeader: true,
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

async function copyText(text: string): Promise<boolean> {
try {
await navigator.clipboard.writeText(text);
return true;
} catch {
// 降级：隐藏 textarea + execCommand
try {
const ta = document.createElement('textarea');
ta.value = text;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
const ok = document.execCommand('copy');
ta.remove();
return ok;
} catch {
return false;
}
}
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
let enabledIds = loadJSON<string[]>(RULES_KEY, CLEANUP_IDS);
// 兼容旧数据：过滤掉未知 id，补上新增的
enabledIds = CLEANUP_IDS.filter((id) => enabledIds.includes(id));

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
<button class="btn ghost" id="btn-convert" title="转换编辑器内文本">转为繁体</button>
<button class="btn ghost" id="btn-copy" title="快捷键 F10">复制全文</button>
</div>
</header>
<div class="docbar" aria-label="文档操作">
<button class="chip" id="btn-new">新建</button>
<button class="chip" id="btn-save">保存草稿</button>
<button class="chip" id="btn-restore">还原草稿</button>
<button class="chip danger" id="btn-clear">清空</button>
<span class="sep"></span>
<span class="lbl">插入</span>
<button class="chip" id="btn-insert-tbc">（未完待续）</button>
<button class="chip" id="btn-insert-end">（全文完）</button>
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
<p class="hint">「一键整理」启用的步骤，Init / End 恒启用</p>
<ul class="rules" id="rules-list"></ul>
<div class="rules-io">
<button class="chip" id="btn-rules-export">导出 JSON</button>
<button class="chip" id="btn-rules-import">导入 JSON</button>
<input type="file" id="rules-file" accept="application/json,.json" hidden>
</div>
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

const editor: EditorHandle = createEditor($('#editor'), {
initialValue: loadJSON<string>(DRAFT_KEY, ''),
onChange: (text) => {
charCount.textContent = `${text.length.toLocaleString()} 字`;
persistDraftDebounced(text);
},
});
charCount.textContent = `${editor.getValue().length.toLocaleString()} 字`;
if (editor.getValue()) draftInfo.textContent = '已载入本地草稿';

/* ---------------- Worker ---------------- */
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
type: 'module',
});
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
const diffOverlay = $('#diff-overlay');
const btnRediff = $('#btn-rediff');

function openDiff(d: LastDiff) {
lastDiff = d;
$('#diff-title').textContent = `${d.label} · 预览`;
const { leftHtml, rightHtml, summary} = renderDiff(d.original, d.result);
$('#diff-left').innerHTML = leftHtml;
$('#diff-right').innerHTML = rightHtml;
const parts = [`共 ${summary.changeCount} 处改动`, `+${summary.addedLines} 行`, `−${summary.removedLines} 行`];
if (summary.truncated) parts.push('（文本过大，仅显示改动区域）');
if (summary.changeCount === 0) parts.push('（文本无变化）');
$('#diff-summary').textContent = parts.join(' ');
diffOverlay.hidden = false;
btnRediff.hidden = false;
}
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
setStatus('完成，等待预览确认');
openDiff({ original: lastInput, result: msg.result, label});
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
if (pipeline === 'cleanup') req.enabledIds = enabledIds;
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
rulesList.innerHTML = CLEANUP_IDS.map((id) => {
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
return `<li class="rule${locked? ' locked': ''}">
<label class="rule-check">
<input type="checkbox" data-rule="${id}" ${checked? 'checked': ''} ${locked? 'disabled': ''}>
</label>
<div class="rule-meta">
<div class="rule-title">${escapeHtml(title)}
${locked? '<span class="tag">恒启用</span>': ''}
${!locked? `<button class="link" data-run-step="${id}">单步运行</button>`: ''}
</div>
${desc? `<div class="rule-desc">${escapeHtml(desc)}</div>`: ''}
</div>
</li>`;
}).join('');
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
const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-run-step]');
if (!btn) return;
runPipeline('singleStep', btn.dataset.runStep!);
});

$('#btn-rules-reset').addEventListener('click', () => {
enabledIds = [...CLEANUP_IDS];
saveJSON(RULES_KEY, enabledIds);
renderRules();
setStatus('规则已重置为默认（全开）');
});
$('#btn-rules-export').addEventListener('click', () => {
const blob = new Blob([JSON.stringify({ version: 1, enabledIds}, null, 2)], {
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
$('#btn-copy').addEventListener('click', async () => {
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，无可复制内容');
return;
}
const ok = await copyText(text);
setStatus(ok? '已复制全文到剪贴板': '复制失败：浏览器拒绝了剪贴板权限');
editor.focus();
});
$('#btn-insert-tbc').addEventListener('click', () => editor.insertAtCursor('（未完待续）'));
$('#btn-insert-end').addEventListener('click', () => editor.insertAtCursor('（全文完）'));

/* ---------------- 简繁转换（只转编辑器文本） ---------------- */
const btnConvert = $('#btn-convert') as HTMLButtonElement;
btnConvert.addEventListener('click', async () => {
const text = editor.getValue();
if (!text) {
setStatus('编辑器为空，无可转换内容');
return;
}
btnConvert.disabled = true;
setStatus('正在加载转换词典…');
try {
const { Converter} = await import('opencc-js');
const convert =
convertDir === 's2t'
? Converter({ from: 'cn', to: 'tw'})
: Converter({ from: 'tw', to: 'cn'});
editor.setValue(convert(text));
convertDir = convertDir === 's2t'? 't2s': 's2t';
btnConvert.textContent = convertDir === 's2t'? '转为繁体': '转为简体';
setStatus('简繁转换完成');
} catch (err) {
setStatus(`转换失败：${err instanceof Error? err.message: String(err)}`);
} finally {
btnConvert.disabled = false;
editor.focus();
}
});

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
} else if (e.key === 'F10') {
e.preventDefault();
$('#btn-copy').click();
} else if (e.key === 'Escape' &&!diffOverlay.hidden) {
closeDiff();
}
});

editor.focus();
}
