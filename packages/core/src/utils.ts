/**
 * 纯函数工具集：对照 old-core-pretty.js 里 `Object.assign(_sp, {...})` 的每个方法
 * 逐一改写为纯函数（不污染 String.prototype），语义逐行对齐原实现。
 *
 * 说明：
 * - `commFmt` / `commReg` 定义在 ./common（只依赖 common，避免循环依赖），
 *   需要时从包根或 ./common 导入。
 * - 原 `$Number/$Letter/$NumberLetter/$Space/$Init/$Finish/$End/...` 等 18 个
 *   conv 方法是各 transform 文件的任务，不在这里。
 * - 原 `maskSep/maskQuote/maskLetter/maskRestore/safetyBefore/safetyAfter`
 *   是带闭包状态的单例（English/Quote/Finish transform 内部使用），留给对应
 *   transform 自行移植；`common._ac` / `common._ei` 同理（English transform
 *   用一行 commFmt 即可算出）。
 */
import { common, commFmt, commReg } from './common';
import { chapterCommon, chapterModel, internalConfig } from './config';

/* ------------------------------------------------------------------ */
/* 基础：换行 / 空白                                                    */
/* ------------------------------------------------------------------ */

/** 原 `_sp.toUNIX` */
export function toUNIX(s: string): string {
  return s.replace(/\r/g, '');
}

/** 模块级单例：原 IIFE 里 `"[{$space}]+".commReg("g")` */
const SPACE_RE: RegExp = commReg('[{$space}]+', 'g');

/** 原 `_sp.space`（命名为 applySpace 避免与概念混淆）：toUNIX 后把空白类字符统一成半角空格 */
export function applySpace(s: string): string {
  return toUNIX(s).replace(SPACE_RE, ' ');
}

/** 原 `_sp.trims`：applySpace 后去掉每行行首空格与文末行尾空格 */
export function trims(s: string): string {
  return applySpace(s)
    .replace(/^ +/gm, '')
    .replace(/ +$/g, '');
}

/** 原 `_sp.findCount`：注意原实现是 `(this.match(e) || "").length` */
export function findCount(s: string, re: RegExp): number {
  return (s.match(re) || '').length;
}

/** 原 `_sp.len`：字符数 + 非单字节字符数（显示宽度近似） */
export function displayLen(s: string): number {
  return s.length + findCount(s, /[^\x00-\xFF]/g);
}

/* ------------------------------------------------------------------ */
/* 模板 / 正则                                                          */
/* ------------------------------------------------------------------ */

/**
 * 原 `_sp.fmt(t, n)`。
 * - map 为 string/number：只替换 `{$zz}` / `{$0}`。
 * - map 为 object：替换 `{$key}` / `{$a.b.c}`，沿点路径取值；
 *   值为数组时用 joiner（默认 ""）连接；取不到（undefined）时保留占位原样。
 */
export function fmt(template: string, map: unknown, joiner?: string): string {
  const e = '' + template;
  const t = typeof map;
  if (t === 'string' || t === 'number')
    return e.replace(/\{\$(?:zz|0)\}/g, map as string);
  if (t !== 'object' || map === null) return e;
  return e.replace(/\{\$[\w\-\.]+\}/g, (ph) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let r: any = map;
    ph
      .slice(2, -1)
      .split('.')
      .every((k) => (r = r[k]) || false);
    if (r === undefined) return ph;
    return Array.isArray(r) ? r.join(joiner || '') : (r as string);
  });
}

/** 原 `_sp.fmtReg(e, t, n)` = `fmt(s, map, joiner)` 后 `getReg(flags)` */
export function fmtReg(
  s: string,
  map: unknown,
  flags?: string,
  joiner?: string,
): RegExp {
  return getReg(fmt(s, map, joiner), flags);
}

/** 原 `_sp.getReg(e)`：flags 缺省 "gm"，"" 保持 "" */
export function getReg(pattern: string, flags?: string): RegExp {
  return RegExp(pattern, flags === '' ? '' : flags || 'gm');
}

/** 原 `_sp.regEscape` */
export function regEscape(s: string): string {
  return s.replace(/[#.*+?^=!:${}()|[\]\/\\-]/g, '\\$&');
}

/** 原 `_sp.getSafeReg(e)` */
export function getSafeReg(s: string, flags?: string): RegExp {
  return getReg(regEscape(s).replace(/\b/g, '\\b'), flags);
}

/**
 * 原 `_sp.cleanSpace(e, t)`：
 * - 给了 pattern：对 pattern 的每个匹配片段，删掉其中的空白（spaceRe，默认 /\s/g）；
 * - 没给 pattern：删掉全文空白。
 */
export function cleanSpace(
  s: string,
  pattern?: RegExp,
  spaceRe: RegExp = /\s/g,
): string {
  return pattern
    ? s.replace(pattern, (m) => m.replace(spaceRe, ''))
    : s.replace(spaceRe, '');
}

/* ------------------------------------------------------------------ */
/* 批量替换                                                             */
/* ------------------------------------------------------------------ */

export type RpsPair = [
  string | RegExp,
  string | ((substring: string, ...args: any[]) => string),
];

/** 原 `_sp.rpArr`：逐对执行 replace；字符串 pattern 按 "g" 转正则 */
export function rpArr(s: string, pairs: RpsPair[]): string {
  return pairs.reduce((acc, p) => {
    const pat = typeof p[0] === 'string' ? getReg(p[0], 'g') : p[0];
    return acc.replace(pat, p[1] as string);
  }, s);
}

/**
 * 原 `_sp.rps`：接受 `[[re|str, 替换], ...]` 数组，
 * 或 `{组名: [[...], ...]}` 对象（按 key 顺序逐组执行）。
 */
export function rps(
  s: string,
  pairs: RpsPair[] | Record<string, RpsPair[]>,
): string {
  if (Array.isArray(pairs)) return rpArr(s, pairs);
  let out = s;
  for (const k in pairs) out = rpArr(out, pairs[k]);
  return out;
}

/**
 * 原 `_sp.rpAtArr(t, e, n)`：
 * pair = [源字符表, 目标表]，目标表按 sep 切分；把源字符表中每个字符
 * 替换为目标表中同下标字符（找不到保留原字符）；mapFn 给定时再映射一次。
 * 注意源字符表是直接拼进 `[...]` 字符组构造正则的（与原实现一致）。
 */
export function rpAtArr(
  s: string,
  pair: [string, string],
  sep: string,
  mapFn?: (v: string) => string,
): string {
  const r = pair[1].split(sep);
  const isFn = typeof mapFn === 'function';
  return s.replace(RegExp('[' + pair[0] + ']', 'g'), (m) => {
    const v = r[pair[0].indexOf(m)] || m;
    return isFn ? (mapFn as (v: string) => string)(v) : v;
  });
}

/** 原 `_sp.rpAt(e)` = rpAtArr(pair, "")：逐字符 1:1 映射 */
export function rpAt(s: string, pair: [string, string]): string {
  return rpAtArr(s, pair, '');
}

/** 原 `_sp.someTest(e)`：数组中任一正则能搜到即 true */
export function someTest(s: string, arr: RegExp[]): boolean {
  return arr.some((re) => s.search(re) > -1);
}

/* ------------------------------------------------------------------ */
/* hook 规则（rpHook / rpHooks）                                         */
/* ------------------------------------------------------------------ */

/**
 * 原 `_sp.rpHook(e)` 的规则对象。
 * hit/skip/need 只在 rpHooks 里用作"命中守卫"；其余键按对象插入顺序执行：
 * - `at*` → rpAt 字符表映射；`rp` → 单次 replace；`rps` → 批量 replace；
 * - `lc` → toLetterCase；`mX` → matchLetterCase(..., X)（X 为键名第二个字符）。
 */
export interface HookDef {
  hit?: RegExp | RegExp[];
  skip?: RegExp;
  need?: RegExp;
  at?: [string, string];
  rp?: [RegExp, string | ((substring: string, ...args: any[]) => string)];
  rps?: RpsPair[];
  lc?: string;
  [extra: string]: unknown;
}

/** 原 `_sp.rpHook(e)`：按 HookDef 的键顺序对整段文本依次应用 at/rp/rps/lc/m* */
export function rpHook(s: string, hook: HookDef): string {
  let n = s;
  for (const t in hook) {
    if (t === 'hit' || t === 'skip' || t === 'need') continue;
    const v = hook[t];
    if (t.slice(0, 2) === 'at') n = rpAt(n, v as [string, string]);
    else if (t === 'rp') {
      const [re, rep] = v as [
        RegExp,
        string | ((substring: string, ...args: any[]) => string),
      ];
      n = n.replace(re, rep as string);
    } else if (t === 'rps') n = rps(n, v as RpsPair[]);
    else if (t === 'lc') n = toLetterCase(n, v as string);
    else if (t.charAt(0) === 'm')
      n = matchLetterCase(n, v as RegExp, t.slice(1, 2));
  }
  return n;
}

/**
 * 原 `_sp.rpHooks(e)`：
 * 有 hit 的 hook：对每个 hit 正则的匹配做守卫检查——匹配全是数字、
 * 或命中 skip、或有 need 却不命中 need 时原样保留，否则对该匹配片段跑 rpHook；
 * 没有 hit 的 hook：对全文直接跑 rpHook。
 * 注意守卫用 `search`（忽略 g 标记、不污染 lastIndex），与原实现一致。
 */
export function rpHooks(s: string, hooks: HookDef[]): string {
  return hooks.reduce((acc, hook) => {
    if (!Object.prototype.hasOwnProperty.call(hook, 'hit'))
      return rpHook(acc, hook);
    const hits = Array.isArray(hook.hit) ? hook.hit : [hook.hit as RegExp];
    return hits.reduce(
      (a2, re) =>
        a2.replace(re, (m) =>
          m.search(/^[\d]+$/) > -1 ||
          (hook.skip !== undefined && m.search(hook.skip) > -1) ||
          (hook.need !== undefined && m.search(hook.need) <= -1)
            ? m
            : rpHook(m, hook),
        ),
      acc,
    );
  }, s);
}

/* ------------------------------------------------------------------ */
/* 行处理 / 对齐                                                         */
/* ------------------------------------------------------------------ */

/**
 * 原 `_sp.mapLine(n)`：按行调 fn(line, index)；
 * 空行不调 fn 直接保留；fn 返回 null/false 时保留原行；最后拼回并补一个末尾换行。
 */
export function mapLine(
  s: string,
  fn: (line: string, index: number) => string | null | false,
): string {
  return (
    s
      .split('\n')
      .map((line, i) => {
        if (line.length < 1) return line;
        const r = fn(line, i);
        return r === null || r === false ? line : r;
      })
      .join('\n') + '\n'
  );
}

/**
 * 原 `_sp.stringAlign(e, t, n)`：(s, prefix, suffix, align)。
 * 按 `2 * linenum` 的行宽用全角空格前置补齐；center/right 的补空格数算法
 * 照抄原实现（`~~(c/4)` / `a%4` 等细节）。
 */
export function stringAlign(
  s: string,
  prefix: string | undefined,
  suffix: string | undefined,
  align: 'left' | 'center' | 'right',
  linenum: number = internalConfig.linenum,
): string {
  const r = ('' + s).trim();
  const a = displayLen(r);
  const c = 2 * linenum - a;
  let out = r;
  if (align !== 'left' && a > 0 && c > 0) {
    if (align === 'center')
      out = '　'.repeat(~~(c / 4)) + (a % 4 > 0 ? '' : ' ') + r;
    else if (align === 'right')
      out = '　'.repeat(~~(c / 2)) + (a % 2 > 0 ? ' ' : '') + r;
  }
  return (prefix || '') + out + (suffix || '');
}

/**
 * 原 `_sp.findCenter(e, t, n)`：(s, re, prefix, suffix)。
 * 对 re 的每个匹配做居中（stringAlign center）。注意原实现是 `this.replace(e, fn)`，
 * 即**逐个匹配**处理，不是逐行——语义照抄。
 */
export function findCenter(
  s: string,
  re: RegExp,
  prefix?: string,
  suffix?: string,
  linenum?: number,
): string {
  return s.replace(re, (m) => stringAlign(m, prefix, suffix, 'center', linenum));
}

/* ------------------------------------------------------------------ */
/* 保护标记                                                             */
/* ------------------------------------------------------------------ */

/**
 * 原 `_sp.maskSafe(e, n)` 的机制：
 * 它**不是**抽取-还原式的保护，而是给每个匹配片段前后打上 `☠`(common.sf) 标记
 * （`"\n" + 片段.trim().replace(/^|$/gm, marker) + "\n"`），让后续
 * 排除 `{$sf}` 的正则跳过这些区域；最后由统一的清理步骤去掉标记。
 *
 * 返回 { text, restore }：restore 复刻原 cleanupEx 里 `_other[0]`
 *（`'[{$sf}]+' → '\n'`）的语义，把标记整体还原为换行。
 * 注意 restore 是全局的（与原实现一致：一次去掉所有 ☠ 标记）。
 */
export function maskSafe(
  s: string,
  re: RegExp | RegExp[],
  marker: string = common.sf,
): { text: string; restore: (s: string) => string } {
  const text = (Array.isArray(re) ? re : [re]).reduce(
    (acc, r) =>
      acc.replace(
        r,
        (m) => '\n' + m.trim().replace(/^|$/gm, marker) + '\n',
      ),
    s,
  );
  const restore = (out: string): string =>
    out.replace(new RegExp('[' + marker + ']+', 'g'), '\n');
  return { text, restore };
}

/* ------------------------------------------------------------------ */
/* 英文大小写                                                           */
/* ------------------------------------------------------------------ */

/** 原 IIFE 里预构建的两个正则（模块级单例，与原实现一致） */
const LC_N: RegExp = commReg('(?:^|[{$han}]| )[{$latin}]', 'gm');
const LC_R: RegExp = commReg("[{$latin}][a-zA-Z\\']+", 'g');

/**
 * 原 `_sp.toLetterCase(e)`：mode 含义照抄——
 * c: 去掉全部空白 / u: 全大写 / l: 全小写 / d: 每个英文单词整体小写
 * f: 首字母大写其余小写 / e: 首字母不变其余小写 / s: 标题式 / z: 先小写再标题式；
 * 未知 mode 返回原字符串。
 */
export function toLetterCase(s: string, mode: string): string {
  const upper = (e: string): string => e.toUpperCase();
  const lower = (e: string): string => e.toLowerCase();
  const first = (e: string): string =>
    e.charAt(0) + e.slice(1).toLowerCase();
  const title = (e: string): string =>
    e
      .replace(/\b[a-z]/g, upper)
      .replace(LC_N, upper)
      .replace(/\'\b[A-Z]+\b/g, lower)
      .replace(LC_R, first);
  switch (mode) {
    case 'c':
      return s.replace(/\s*/g, '');
    case 'u':
      return s.toUpperCase();
    case 'l':
      return s.toLowerCase();
    case 'd':
      return s.replace(/\b[a-zA-Z]+\b/g, lower);
    case 'f':
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    case 'e':
      return s.charAt(0) + s.slice(1).toLowerCase();
    case 's':
      return title(s);
    case 'z':
      return title(s.toLowerCase());
    default:
      return s;
  }
}

/** 原 `_sp.matchLetterCase(e, t)`：对 re 的每个匹配做 toLetterCase(mode) */
export function matchLetterCase(s: string, re: RegExp, mode: string): string {
  return s.replace(re, (m) => toLetterCase(m, mode));
}

/* ------------------------------------------------------------------ */
/* 章节正则                                                             */
/* ------------------------------------------------------------------ */

export interface ChapFlag {
  str: string;
  flag: string;
  /** flag 去掉 "g" 后的版本（原实现 `e.replace("g", "")`，只去第一个） */
  t: string;
}

/**
 * 原 `_sp.chapFlag(e, t)`：(tpl, flags, joinStr)。
 * 两遍 fmt：先用 chapterModel 展开 `{$t0}` 等（数组值用 joinStr 连接），
 * 再用 chapterCommon 展开剩余 `{$xxx}`（支持 `{$c.0}` 点路径）；
 * flags 缺省 "gm"，"" 保持 ""；模板含 "chapter" 且 flags 无 "i" 时补 "i"。
 */
export function chapFlag(
  tpl: string,
  flags?: string,
  joinStr?: string,
): ChapFlag {
  const resolved = fmt(fmt(tpl, chapterModel, joinStr), chapterCommon);
  let e = flags === '' ? '' : flags || 'gm';
  if (e !== '' && e.indexOf('i') < 0 && resolved.indexOf('chapter') > -1)
    e += 'i';
  return { str: resolved, flag: e, t: e.replace('g', '') };
}

/** 原 `_sp.chapReg(e, t)`：chapFlag 后 getReg */
export function chapReg(tpl: string, flags?: string, joinStr?: string): RegExp {
  const f = chapFlag(tpl, flags, joinStr);
  return getReg(f.str, f.flag);
}

/** 原 IIFE 预构建的 chapSafety 三件套（模块级单例，与原实现一致） */
const CHAP_SAFETY_RES: RegExp[] = [
  chapReg('\\n(?:(?:{$sw}){$s}.*\\n(?:[^第\\n].*\\n){0,2}){2,10}', 'g'),
  chapReg('\\n(?:[\\(（](?:{$sw})[\\)）].*\\n(?:[^第\\n].*\\n){0,2}){2,10}', 'g'),
  /\n(?:第.+[。；…]\n){3,20}/g,
];
const CHAP_SAFETY_LINE: RegExp = chapReg(
  '^(?:(?:{$sw}){$s}|[\\(（第]).+$',
  'gm',
);
const CHAP_SAFETY_REP: string = commFmt('{$sf}$&{$sf}');

/**
 * 原 `_sp.chapSafety()`：把"疑似章节但需要保护不被误改"的多行块
 * 用 ☠ 标记包裹（机制同 maskSafe，标记为 `"{$sf}$&{$sf}"`）。
 */
export function chapSafety(s: string): string {
  return CHAP_SAFETY_RES.reduce(
    (acc, re) =>
      acc.replace(
        re,
        (m) => '\n' + m.trim().replace(CHAP_SAFETY_LINE, CHAP_SAFETY_REP) + '\n',
      ),
    s,
  );
}
