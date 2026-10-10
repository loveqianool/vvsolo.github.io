/**
* 业务 pipeline：4 条面向用户的排版流程。
*
* - cleanup：对照 ~/workspace/old-api.js `editorCleanUp`（纯函数版），
* 即旧 UI 版"一键整理"全选 11 个 checkbox 时的行为。
* - cleanupEx：对照 old-api.js `editorCleanUpEx`（特殊整理）。
* - runTypesetSplit：对照 old-api.js `onTypeSetSplit(str, author, site)`（分段排版）；
* 标头开关 addHeader 对应旧版 #Check_AddTop，是否首发 isFirst 对应 #Check_0。
* - runTypesetRead：对照 ~/workspace/old-typeset.js `onTypeSetRead`（阅读排版），
* DOM 读取的部分全部改为参数。
*
* cleanupEx / typesetSplit / typesetRead 是函数式 pipeline
*（内部按固定顺序调 transform，不经过 runPipeline），
* 因此 PIPELINE_STEPS 里这三项 steps 为空——UI 的规则开关面板只展示 cleanup。
*/
import { common, commReg} from './common';
import { internalConfig, resolveConfig} from './config';
import { defaultConfig} from './types';
import { getTransform, runPipeline} from './registry';
import type { PipelineId, RunContext, Step} from './types';
import {
chapReg,
displayLen,
findCenter,
findCount,
fmt,
getReg,
mapLine,
maskSafe,
rpAt,
rps,
trims,
} from './utils';

export const PIPELINE_STEPS: Record<PipelineId, Step[]> = {
  cleanup: [
    'Init',
    'HtmlEntity',
    // HtmlTag / EmptyBrackets 为新增的可选规则，默认关闭（defaultEnabled: false）
    { id: 'HtmlTag', defaultEnabled: false },
    'Unicode',
    'Variant',
    'SerialNumber',
    'Punctuation',
    'NumberLetter',
    'Chapter',
    'Space',
    'Separator',
    'Quote',
    { id: 'EmptyBrackets', defaultEnabled: false },
    'English',
    'End',
  ].map((s) => (typeof s === 'string' ? { id: s } : s)),
// 函数式 pipeline：steps 为空（见文件头注释）
cleanupEx: [],
typesetSplit: [],
typesetRead: [],
};

function fullContext(ctx?: Partial<RunContext>): RunContext {
return { config: ctx?.config?? defaultConfig, onStep: ctx?.onStep};
}

/** 一键整理：跑 cleanup steps，被 enabledIds 排除的步骤设 enabled:false */
export function runCleanup(
  text: string,
  enabledIds?: string[],
  ctx?: Partial<RunContext>,
  order?: string[],
): string {
  const base = PIPELINE_STEPS.cleanup;
  // order：用户自定义的步骤顺序；未列出的步骤保持原相对顺序缀在后面
  let steps = base;
  if (order && order.length > 0) {
    const seen = new Set<string>();
    const ordered: Step[] = [];
    for (const id of order) {
      const s = base.find((x) => x.id === id);
      if (s && !seen.has(id)) {
        seen.add(id);
        ordered.push(s);
      }
    }
    for (const s of base) if (!seen.has(s.id)) ordered.push(s);
    steps = ordered;
  }
  const mapped = steps.map((s) => ({
    ...s,
    enabled: enabledIds
      ? enabledIds.includes(s.id)
      : s.defaultEnabled !== false,
  }));
  return runPipeline(text, mapped, ctx);
}

/* ------------------------------------------------------------------ */
/* doSplit：对照 old-api.js 顶部的 doSplit 逐行移植 */
/* ------------------------------------------------------------------ */
function doSplit(str: string, ctx: RunContext): string {
const bm = '\n';
if (str.length < 1 || str.startsWith('　　') || str.startsWith('＊＊＊＊＊')) {
return str + bm;
}
const safeSrc = '^' + common.sf;
if (str.search(getReg(safeSrc, '')) > -1) {
return str.replace(getReg(safeSrc, 'g'), '');
}

// 分隔字数、实际分隔字数（原 config.Linenum → resolveConfig(ctx).linenum）
const vNum = resolveConfig(ctx).linenum;
const cutNum = vNum * 2;
let linestr = '　　' + str;
// 小于每行最大字数时直接返回
if (cutNum >= displayLen(linestr)) {
return linestr + bm;
}

let oNum = ~~(linestr.length / vNum) + 1;
// 查询单字节总数
const findEngStr = findCount(linestr, /[\x00-\xff]/g);
// 如果全是单字节
const findAllEngStr = str.search(/^[\x00-\xff]+$/) > -1;
const text: string[] = [];

while (oNum--) {
let sublen = 0;
const firstLine = true;
let sinBytes = 0;
let tmp = '';
let k = 0;
// 如果全是单字节
if (findAllEngStr) {
// 如果是首次截取（注：原实现把 FirstLine 声明在循环内，
// 恒为 true，sublen 恒为 vNum - 2，照抄该行为）
if (firstLine) {
sublen = vNum - 2;
} else {
sublen = vNum;
}
}
// 如果有英文
else if (findEngStr > 0) {
// 预分段
tmp = linestr.slice(0, vNum);
// 英文单字节数
sinBytes = findCount(tmp, /[\x00-\xff]/g);
if (sinBytes) {
// 预取补齐字符串，如果全是双字节
//（注：原实现 slice(vNum, sinBytes) 在 sinBytes<=vNum 时恒为空，
// 该分支实际走不到，照抄以保持行为一致）
if (displayLen(linestr.slice(vNum, sinBytes)) === sinBytes * 2) {
sublen = ~~(sinBytes / 2);
} else {
// 预取英文半数
sublen = Math.round(sinBytes / 2);
k = sublen;
while (k--) {
sublen++;
if (displayLen(linestr.slice(0, vNum + sublen)) > cutNum) {
sublen--;
break;
}
}
}
}
}
// 按修正后的字数截取字符串
tmp = linestr
.slice(0, vNum + sublen)
// 防止行尾限制标点，放置到下行
// 防止英文单词断行，放置到下行
// ［〔【｛·‘『“「〈《
.replace(/[［〔【｛『「〈《]{1,2}$/, (m) => {
linestr += m;
return '';
});
// 剩下部分
linestr = linestr
.replace(tmp, '')
// 判断并处理行首限制字符
// 处理两个字符，因为经过整理过的标点只留两个
// ，、。：；？！）］〕】〗･’』”」〉》…～—
.replace(/^[，、。：；？！）］〕】〗･’』”」〉》…～—]{1,2}/, (m) => {
tmp += m;
return '';
});
text.push(tmp);
}
return text.join('\n').replace(/\n+$/, '') + bm;
}

/* ------------------------------------------------------------------ */
/* 特殊整理：对照 old-api.js editorCleanUpEx */
/* ------------------------------------------------------------------ */
export function runCleanupEx(text: string, ctx?: Partial<RunContext>): string {
const full = fullContext(ctx);
const T =
(id: string, args: string[] = []) =>
(s: string): string =>
getTransform(id).run(s, args, full);

/****** 修正错误换行 ******/
const breakPairs: Array<[RegExp, (m: string) => string]> = [
commReg('[^。！？…”：；〗】{$sf}]\\n[^{$sf}]', 'gm'),
commReg('[^。！？…”：；〗】{$sf}]\\n[^{$sf}]', 'gm'),
commReg('^(?!第[\\d一二三四五六七八九十百千]+|{$sf}).+“[{$han}]+”\n+', 'gm'),
commReg('^[^{$sf}\\n]*“[^，：。？！…～\\─\\n]+”\\n+', 'gm'),
/…\n[^”\n]+”$/gm,
/，”\n/g,
// 修正被分隔的标点符号
/…\n…/g,
/\n”/g,
/\n^“$/gm,
].map((re) => [re, (m: string) => m.replace(/\n/g, '')] as [
RegExp,
(m: string) => string,
]);

/****** 其他自定义修正 ******/
const otherPairs: Array<[string | RegExp, string]> = [
// 去除标题保护
[commReg('[{$sf}]+', 'g'), '\n'],
// 文章中的书名换行
[commReg('(?=[^。！？…”：；〗】{$sf}])\n《', 'g'), '《'],
[/第[\d一二三四五六七八九十百千]+章：/g, '\n$&'],
// 其他修正
[internalConfig.endStrs, ''],
[/“$/gm, '”'],
[/^“”$/gm, '“……”'],
];

// 排版初始化，去空格空行
// 去除汉字间的空格
let s = T('Init')(text);
s = T('Space')(s);
s = T('NumberLetter')(s);
// 保护引用作者
s = maskSafe(s, /^——.{1,10}[^，。…！？]$/gm).text;
// 保护以 —— 开头的一组对话
s = maskSafe(s, /^(?:——.+\n){2,10}/g).text;
// 保护无结尾标点的歌词类
s = maskSafe(s, /^(?:[\u4E00-\u9FA5]+[^，：;。…！？:;\,\.\!\?]\n){3,16}/gm).text;
// 修正章节最后是句号的
s = s.replace(/章[节節]$/g, '章');
s = s.replace(chapReg('^({$t91}[{$c.2}]{$sn}.{$en})。$'), '$1');
// 修正章节前面是 `正文` 的
s = s.replace(chapReg('^正文 *({$t91}[{$crt}]{$sn}.{$en})$'), '$1');
// 修正章节标题，加标题保护码（safe 模式）
s = T('Chapter', ['fix', 'safe'])(s);
// 修正引号
s = T('Quote')(s);
// 修正错误换行
s = rps(s, breakPairs);
// 其他自定义修正
s = rps(s, otherPairs);
// 去除汉字间的空格
s = T('Init')(s);
s = T('Space')(s);
s = T('Punctuation')(s);
s = T('Separator')(s);
// 修正章节标题
s = T('Chapter', ['nofix'])(s);
// 修正引号
s = T('Quote')(s);
s = T('End')(s);
return s;
}

/* ------------------------------------------------------------------ */
/* 分段排版：对照 old-api.js onTypeSetSplit(str, author, site) */
/* ------------------------------------------------------------------ */
export interface TypesetSplitOptions {
author?: string;
site?: string;
/** 是否首发（旧版 #Check_0），缺省 false */
isFirst?: boolean;
/** 是否添加标头（旧版 #Check_AddTop），缺省 false */
addHeader?: boolean;
/** 标头日期，缺省 new Date() */
now?: Date;
}

export function runTypesetSplit(
text: string,
opts: TypesetSplitOptions = {},
ctx?: Partial<RunContext>,
): string {
const full = fullContext(ctx);
const linenum = resolveConfig(full).linenum;
const T =
(id: string, args: string[] = []) =>
(s: string): string =>
getTransform(id).run(s, args, full);

if (trims(text) === '') return text;

// 执行整理
let s = T('Init')(text);
// 转直角引号
s = T('CNQuote')(s);
// 清除原标头
s = s.replace(
/作者：.*?\n[\d/]*[发發]表[于於]：.*?\n是否首[发發]：.*?\n字[数數]：.*?\n/gm,
'',
);
// 转换半角
// 修正分隔符号
s = T('NumberLetter')(s);
s = T('Separator')(s);
// 书名居中
s = findCenter(s, /^《[^》]+》$/m, undefined, undefined, linenum);
// 分隔符居中
s = findCenter(s, getReg(internalConfig.separator, 'gm'), undefined, undefined, linenum);
// 结尾居中
s = findCenter(s, internalConfig.endStrs, undefined, undefined, linenum);
// 标题居中
s = T('Chapter', ['center'])(s);
// 分割段落
s = mapLine(s, (line) => doSplit(line, full));
s = T('Finish')(s);
s = rpAt(s, ['‘’“”', '『』「」']);
s = '\n' + s;

if (opts.addHeader !== true) return s;
// 插入标头
const dateStr = new Intl.DateTimeFormat('zh-CN', {
year: 'numeric',
month: '2-digit',
day: '2-digit',
}).format(opts.now?? new Date());
const head = fmt(
'作者：{$w}\n{$d}发表于：{$b}\n是否首发：{$y}\n字数：{$n} 字\n',
{
w: opts.author,
b: opts.site,
y: opts.isFirst === true? '是': '否',
d: dateStr,
n: (s.length - findCount(s, /[　\s]/g)).toLocaleString(),
},
);
return head + '\n\n' + s + '\n\n';
}

/* ------------------------------------------------------------------ */
/* 阅读排版：对照 old-typeset.js onTypeSetRead */
/* ------------------------------------------------------------------ */
export function runTypesetRead(
text: string,
ctx?: Partial<RunContext>,
): string {
const full = fullContext(ctx);
const T =
(id: string, args: string[] = []) =>
(s: string): string =>
getTransform(id).run(s, args, full);

let s = T('Init')(text);
s = T('Separator')(s);
s = T('Chapter', ['nofix'])(s);
s = s.replace(internalConfig.novelAuthor, '$1\n');
s = s.replace(/^/gm, '　　');
s = s.replace(/(^　　$\n)+/gm, '　　\n');
s = s.replace(/\n\n{2,}/g, '\n\n');
s = s.replace(/^\n{2,}/, '\n');
return s;
}
