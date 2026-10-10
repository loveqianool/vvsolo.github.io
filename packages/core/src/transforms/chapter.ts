/**
* Chapter transform（章节标题修正）。
*
* 逐行对照 ~/workspace/old-core-pretty.js 的 `_sp.$Chapter` /
* `_sp.$ChapterFix` / `_sp.__ChapterPrep` / `_sp.__ChapterHandle` /
* `_sp.__ChapterZero` / `_sp.__ChapterSkip` / `_sp.__ChapterSafeRestore`
* 移植为纯函数（原实现挂在 String.prototype 上，这里全部显式传参）。
*
* args 语义（对应原 `.conv('Chapter', c, i, p)` 的三个位置参数）：
* - args[0]（c）：'nofix' | 'fix' | 'center' | 'left' | 'right'，缺省 'fix'。
* 只有 'fix' 会跑 $ChapterFix（t4/t5/t6 规范，如"3章"→"第三章"）；
* 'center' / 'left' / 'right' 控制标题对齐方式。
* - args[1]（i）：标题前缀，缺省 '\n\n'；传 'safe' 进入安全模式：
* 前后缀改用 ☠ 标记（common.sf），且只匹配带"第"的标题。
* 注意：安全模式会改写 chapterModel.t2 = chapterModel.t21，
* 原实现同样是永久改写（cleanupEx 依赖该语义），这里照搬。
* - args[2]（p）：标题后缀，缺省 ''。
*/
import { common, commReg} from '../common';
import { chapterCommon, chapterModel, resolveConfig} from '../config';
import { getTransform} from '../registry';
import type { RunContext, Transform} from '../types';
import {
chapFlag,
chapReg,
chapSafety,
cleanSpace,
fmt,
getReg,
someTest,
stringAlign,
trims,
} from '../utils';

/* ------------------------------------------------------------------ */
/* 原 IIFE 末尾的正则常量（((c) => {...})({...}) 传进来的那个对象） */
/* ------------------------------------------------------------------ */
const CHAP_B = chapReg('^[{$b.0}].+[{$b.1}]$', '');
const CHAP_SEP_LEAD = chapReg('^[{$sep}]+', '');
const CHAP_T1_WRAP = chapReg('^(?:[{$nc}]|[0-9]{1,2})$', '');
const CHAP_T5_TRAIL = chapReg('{$w3}+$', '');
const CHAP_S1 = chapReg(
'([^0-9a-zA-Z\\.])[ ·—-]([{$nc}]|[{$n}]{1,2}|[ivxcIVXC]{1,6})$',
'',
);
const CHAP_S2 = chapReg('[ ·]([{$nc}]|[ivxcIVXC]{1,6})$', '');
const CHAP_S3 = chapReg('([^0-9])[ ·]([0-9]{1,2})$', '');
const CHAP_S4 = commReg(' (?=[{$han}]+)', 'g');
const CHAP_S5 = commReg('^（([0-9]{1,9})）$', '');
const CHAP_P0 = chapReg('[{$b}]', 'g');
const CHAP_P1 = chapReg('[，。]|{$w2}[{$b.1}]$', '');
const CHAP_P2 = chapReg(
'^(?:第?{$n2}|第?{$n3}|{$n4})[{$c}]?(?:{$s}{$e})?[{$b.1}]$',
'',
);

/* ------------------------------------------------------------------ */
/* chap.list / chap.skips（原 chap 对象上的表） */
/* ------------------------------------------------------------------ */
const CHAP_LIST: Record<string, { tpl: string; join?: string}> = {
t0: { tpl: '^(?:{$t0}){$sn}$'},
t1: { tpl: '^({$t1})({$sn}|{$sz}{$e})$', join: '|'},
t2: { tpl: '^{$t2}({$sn})({$e}|$)$'},
t3: { tpl: '^{$t3}({$e}|$)$'},
t4: { tpl: '^{$t4}({$s}|{$s}{$e}|$)$'},
t5: { tpl: '^{$t5}{$sn}({$e}|$)$'},
t6: { tpl: '^{$t6}({$s}|{$s}{$e}|$)$'},
};

const CHAP_SKIPS: Record<string, RegExp[]> = {
t0: [/[。;；—]$/, /^[-—]{1,2}/, /^\d{1,6}(?:[.,，。]\d{1,6})+/],
t1: [
/^(?:[上下]回|断章取义|同人不|序[长词战兴常稿歌秩次传述長詞戰興傳]|[开尾][部集阙季册闕冊章折回话节幕節話]|[前后上下中]段)/,
],
t2: [
/^(?:上节[目课]|下节课|[上下]篇作[业文]|[零○〇])/,
/^[一二三四五六七八九十]{1,2}[爷奶爹娘爸妈舅叔姨婶嫂哥姐弟妹儿女孙侄子]/,
/^(?:一(?:[直切生世味边旁幕起到]|回[复合首头到])|二话[没不沒]|三[生世八]|四[周边处海]|五[谷更体]|[百千][折转]|千篇一律|[伍陆]部长)/,
/^第?[零一二三四五六七八九十百两]{1,3}(?:季度|卷[书经]|篇[篇经文]|[部集](?:戏|戲|电[影视視]|的|小说)|部好莱坞|回合|节课|段时间|场比赛)/,
chapReg(
'^第?[{$n}][{$c}](?:《|……|[？！]{1,3}|[{$n}]|[，、]?第|[呢吗啊吧哈])',
'',
),
],
t3: [
chapReg('^(?:{$n1}|{$n2})[年月日]', ''),
/^[一二三十](?:[，、][一二三八九]){1,}/,
/^(?:一二三|三二一)[，。！…]/,
/^([一二三四五六七八九十百两兩])\1/,
/^(?:壹[壹拾伍]|叁[叁伍捌]|伍[伍陆]|陆[陆]|拾[金取]|十[万分]|百[分千]|万[万千])/,
/^[一二三四五六七八九十]{1,3}(?:[千万]两|[，、].*[…]$)/,
],
t6: [
/^\b\d{1,4}(?:[.。\-—\/、,，:：]\d{1,12}){1,}/,
/^[\d０-９一二三四五六七八九十]{1,4}[年月][\d０-９一二三四五六七八九十]{1,3}[月日]/,
/^\b[\d.\-—\至]{1,12}[%％‰℃°万亿wmbkWMBK]/,
/^[\d０-９一二三四五六七八九十百千万]{1,12}[元块次多]?[！？。…]{1,3}$/,
/^[\d０-９]{1,4}(?:[、，][\d０-９]{1,4}){1,}/,
],
};

/* ------------------------------------------------------------------ */
/* 小构件：原 __ChapterZero / __ChapterSkip / __ChapterHandle */
/* ------------------------------------------------------------------ */

/** 原 `_sp.__ChapterZero`：独立个位数字补零（\b[1-9]\b → 0$&） */
function chapterZero(s: string): string {
return s.replace(/\b[1-9]\b/g, '0$&');
}

/** 原 `_sp.__ChapterSkip(e)`：命中 chap.skips[e] 任一即跳过 */
function chapterSkip(s: string, key: string = 't0'): boolean {
return someTest(s, CHAP_SKIPS[key]);
}

/**
* 原 `_sp.__ChapterHandle(e, t)`：
* - noDivide 为真时不加分隔符（原 `e? "": config.Divide`），否则加 internalConfig.divide（"："）；
* - t === 't1' 时把纯数字/上下等小节名包成全角括号；
* - t === 't5' 时去掉末尾的 ☆★ 等符号；
* - 之后走一串规范化替换（数字括号、注脚号等）。
*/
function chapterHandle(
s: string,
noDivide?: unknown,
t?: string,
): string {
let n = s
.replace(/ +/g, ' ')
.replace(CHAP_B, (e) => e.slice(1, -1))
.replace(CHAP_SEP_LEAD, '');
const prefix = noDivide? '': '：';
if (n.length < 1) return '';
if (t === 't1') n = n.replace(CHAP_T1_WRAP, '（$&）');
else if (t === 't5') n = n.replace(CHAP_T5_TRAIL, '');
return isNaN(Number(n))
? prefix +
n
.replace(/^[上中下一二三四五续补再终完]{1,3}$/, '（$&）')
.replace(CHAP_S1, '$1（$2）')
.replace(CHAP_S2, '（$1）')
.replace(CHAP_S3, '$1（$2）')
.replace(/（(\d)）$/, '（0$1）')
.replace(CHAP_S4, '，')
.replace(CHAP_S5, '$1')
: prefix + n;
}

/* ------------------------------------------------------------------ */
/* 原 `_sp.__ChapterPrep(e, t)` */
/* ------------------------------------------------------------------ */
type ChapterHandler = (
match: string,
g1: string,
g2: string,
g3: string,
) => string;

function chapterPrep(
text: string,
key: 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6',
handler: ChapterHandler,
): string {
const entry = CHAP_LIST[key];
let model: string | string[] = chapterModel[key] as string | string[];
let joinStr = '';
if (entry.join) {
joinStr = entry.join;
model = (model as string[]).join(joinStr);
}
const flag = chapFlag(entry.tpl, 'gm', joinStr);
// 预清理：形如的行，若内容不是真章节则剥掉括号
const preCleanRe = chapReg(
fmt('^[{$b.0}](?:{$0})[{$b.1}]?(?:{$sn}{$e})?$', model as string),
);
const cleaned = text.replace(preCleanRe, (m) =>
m.search(CHAP_P1) > -1 ||!(m.slice(1).search(CHAP_P2) > -1)
? m
: trims(m).replace(CHAP_P0, ' ').replace(/^ +/, ''),
);
// 主匹配：原实现会从正则源码里删掉全角数字区间（０-９），照抄
const mainRe = getReg(flag.str.replace(/０-９|[０-９]/g, ''), flag.flag);
return cleaned.replace(
mainRe,
handler as (substring: string,...args: unknown[]) => string,
);
}

/* ------------------------------------------------------------------ */
/* 主流程：原 `_sp.$Chapter(c, i, p)` */
/* ------------------------------------------------------------------ */
function chapterRun(
text: string,
cArg: string | undefined,
iArg: string | undefined,
pArg: string | undefined,
ctx: RunContext,
): string {
const c = ['nofix', 'fix', 'center', 'left', 'right'].includes(cArg || '')
? (cArg as string)
: 'fix';
let p = pArg || '';
let i = iArg || '\n\n';
if (i === 'safe') {
i = p = common.sf;
chapterModel.t2 = chapterModel.t21;
}
const linenum = resolveConfig(ctx).linenum;
// 'nofix'/'fix' 在 stringAlign 里走不到 center/right 分支，
// 效果等同原实现（仅 trim + 前后缀），这里直接透传
const align = (e: string): string =>
stringAlign(e, i, p, c as 'left' | 'center' | 'right', linenum);

const sN4Start = chapReg('^(?:{$n4})', '');
const oW2 = chapReg('^{$w2}$');
const rSsEnd = chapReg('{$ss}$', '');

let out = getTransform('Number').run(text, [], ctx);
out = cleanSpace(out, chapReg('{$ts}', 'g'));
out = chapSafety(out);

out = chapterPrep(out, 't0', (e) => align(e));

out = chapterPrep(out, 't1', (e, t, n) => {
if (
(n && n.search(/^[!?！？。…]{1,3}$/) > -1) ||
chapterSkip(e, 't0') ||
chapterSkip(e, 't1')
)
return e;
if (n) {
n = chapterHandle(n, n.startsWith('之'), 't1');
} else {
t = t
.replace(rSsEnd, (m) => '（' + m.replace(/[（()）]/g, '') + '）')
.replace(/（）/, '');
}
return align(t + n);
});

out = out.replace(/序：之[章卷]/g, (m) => m.replace(/：/, ''));

out = chapterPrep(out, 't2', (e, t, n, r) => {
if (r && r.search(oW2) > -1) return '';
const startsWithDi = t.charAt(0) === '第';
n = startsWithDi && r && r.search(/\d/) > -1? '：': n;
if (
(!n &&!startsWithDi) ||
r.search(/^[！？。…]{1,3}$/) > -1 ||
(!n && r && r.search(/[，。]/g) > -1) ||
chapterSkip(e, 't0') ||
chapterSkip(e, 't2')
)
return e;
t = t.search(sN4Start) > -1? t: '第' + t.replace(/^第+/, '');
return align(chapterZero(t) + chapterHandle(r));
});

out = chapterPrep(out, 't3', (e, t, n) => {
if (chapterSkip(e, 't0') || n.indexOf(t) > -1) return e;
return align(chapterZero(t) + chapterHandle(n, 'no'));
});

// 原 `$ChapterFix(i, p, "fix" === c)`
if (c === 'fix') {
const ct = chapterCommon.ct as string;
out = chapterPrep(
out,
't4',
(e, t, n, r) => i + '第' + n + t + chapterHandle(r) + p,
);
out = chapterPrep(
out,
't5',
(e, t, n) =>
i + '第' + chapterZero(t) + ct + chapterHandle(n, false, 't5') + p,
);
out = chapterPrep(out, 't6', (e, t, n) => {
n = trims(n);
if (
n.search(/^[！？。…—]{1,3}$/) > -1 ||
n.search(t.search(/^\d+/) > -1? /[！？。]$/: /[！？。…’”』」]$/) >
-1 ||
chapterSkip(e, 't0') ||
chapterSkip(e, 't2') ||
chapterSkip(cleanSpace(e), 't6')
)
return e;
return i + '第' + chapterZero(t) + ct + chapterHandle(n) + p;
});
}

// 原 `__ChapterSafeRestore(~i.indexOf(common.sf))`：
// safe 模式保留 ☠ 标记（后续步骤清理），否则立即去掉
if (i.indexOf(common.sf) < 0) out = out.replace(commReg('{$sf}', 'g'), '');
return out;
}

export const transform: Transform = {
id: 'Chapter',
title: '章节标题修正',
description:
'识别章节标题行并规范格式：统一"第X章"写法、数字补零、标题对齐；safe 模式（特殊整理内部使用）只匹配带"第"的标题并用标记保护。',
run(text: string, args: string[], ctx: RunContext): string {
return chapterRun(text, args[0], args[1], args[2], ctx);
},
};

/* ------------------------------------------------------------------ */
/* 章节目录检测：复用 CHAP_LIST 的匹配模板 + chapterSkip 守卫，只做      */
/* 识别不做格式化，供"查看目录"功能按行号跳转。                         */
/* ------------------------------------------------------------------ */

export interface ChapterEntry {
  /** 行号（1-based，对应编辑器行） */
  line: number;
  /** 标题文本（去首尾空白） */
  title: string;
}

type DetectKey = 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6';
/** 各模板在原 handler 里的 skip 守卫（照抄 chapterRun 里的检查） */
const DETECT_SKIPS: Record<DetectKey, string[]> = {
  t0: [],
  t1: ['t0', 't1'],
  t2: ['t0', 't2'],
  t3: ['t0'],
  t4: [],
  t5: [],
  t6: ['t0', 't2', 't6'],
};

const DETECT_RES = (['t0', 't1', 't2', 't3', 't4', 't5', 't6'] as DetectKey[]).map(
  (key) => {
    const entry = CHAP_LIST[key];
    const joinStr = entry.join ?? '';
    // flags 沿用 chapterPrep 的 'gm'（含 t5 的 chapter → i 逻辑）；
    // 单行 search 时 m/g 无影响
    const flag = chapFlag(entry.tpl, 'gm', joinStr);
    const re = getReg(flag.str.replace(/０-９|[０-９]/g, ''), flag.flag);
    return { key, re };
  },
);

/** 单行是否为章节标题（与 Chapter transform 的识别口径一致） */
export function isChapterLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  for (const { key, re } of DETECT_RES) {
    // 模板自带 ^...$ 全行锚定；用 search 避免 lastIndex 污染
    if (s.search(re) > -1) {
      const skips = DETECT_SKIPS[key];
      let skipped = false;
      for (const k of skips) {
        const target = k === 't6' ? cleanSpace(s) : s;
        if (chapterSkip(target, k)) {
          skipped = true;
          break;
        }
      }
      if (!skipped) return true;
    }
  }
  return false;
}

/** 扫描全文，返回章节目录（行号 1-based） */
export function detectChapters(text: string): ChapterEntry[] {
  const out: ChapterEntry[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isChapterLine(lines[i])) {
      out.push({ line: i + 1, title: lines[i].trim() });
    }
  }
  return out;
}
