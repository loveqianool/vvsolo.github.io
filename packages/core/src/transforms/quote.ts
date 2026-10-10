/**
 * Quote（原 `_sp.$Quote`）：引号修正。
 *
 * 语义：`this.safetyBefore().rps(QUOTE_RPS).safetyAfter()`。
 * - safetyBefore：用 mask 机制保护"英文缩写里的引号"（config.enSep）、
 *   "坐标里的引号"（config.rCoord）以及 `"ABC"` / `'ABC'` 这类纯字母数字
 *   引号内容，使中间的 rps 不破坏它们；
 * - rps：12 组规则，把 `＇‹›` 等归一为 `'`，`«»‟„〝〞…` 归一为 `"`，
 *   再按"成对出现→弯引号，落单→开引号，行尾特定标点前→闭引号"配对；
 * - safetyAfter：还原 mask，并把残留的直引号包裹形态规范为弯引号，
 *   处理英文缩写 `'s` 的大小写。
 * 逐行对照 old-core-pretty.js 的 mask IIFE / safetyBefore / safetyAfter /
 * `((_sp.$Quote = ...)...)({ at, rps })`。
 */
import type { Transform, RunContext } from '../types';
import { internalConfig } from '../config';
import {
  getReg,
  matchLetterCase,
  rpAt,
  rps,
  toLetterCase,
  type RpsPair,
} from '../utils';

/* ------------------------------------------------------------------ */
/* 有状态单例：原 `((r, a) => {...})({}, -1)` IIFE 闭包                  */
/* 模块级共享（跨调用累积），与原实现一致；token 形如 〔☯0〕、〔☯1〕…     */
/* ------------------------------------------------------------------ */

const maskStore: Record<string, string> = {};
let maskSeq = -1;

/** 原 `maskSep` 的 normalize 字符表（导出供校验） */
export const MASKSEP_AT: [string, string] = ['。“”『』‘’「」', '.""""\'\'\'\''];

/** 原 IIFE 里的 `e(t)` 工厂：对 re 的每个匹配做 normalize 后做 token 映射 */
function maskWith(re: RegExp, normalize: (m: string) => string) {
  return (s: string): string =>
    s.replace(re, (m) => {
      const key = normalize(m);
      if (!(key in maskStore)) maskStore[key] = '〔☯' + ++maskSeq + '〕';
      return maskStore[key];
    });
}

/** 原 `maskSep`：normalize 时把 。“”『』‘’「」 映射为 MASKSEP_AT */
export const maskSepOf = (re: RegExp): ((s: string) => string) =>
  maskWith(re, (m) => rpAt(m, MASKSEP_AT));

/** 原 `maskQuote`：normalize 时把引号换成 〔☯22〕/〔☯27〕 再 token 化 */
function maskQuote(s: string, re: RegExp): string {
  return maskWith(re, (m) =>
    m.replace(/[“”「」"]/g, '〔☯22〕').replace(/[‘’『』']/g, '〔☯27〕'),
  )(s);
}

/** 原 `maskRestore`：按插入顺序还原所有 token，再把 22/27 还原为直引号 */
function maskRestore(s: string): string {
  let t = s;
  for (const k in maskStore) t = t.replace(getReg(maskStore[k], 'g'), k);
  return t.replace(/〔☯22〕/g, '"').replace(/〔☯27〕/g, "'");
}

/** 原 `safetyBefore` */
function safetyBefore(s: string): string {
  return maskQuote(
    maskQuote(
      maskSepOf(internalConfig.rCoord)(maskSepOf(internalConfig.enSep)(s)),
      /[“"]([0-9a-zA-Z]+)[”"]/g,
    ),
    /[‘']([0-9a-zA-Z]+)[’']/g,
  );
}

/** 原 `safetyAfter` */
function safetyAfter(s: string): string {
  return matchLetterCase(
    maskRestore(s)
      .replace(/[“"]([^”"，。\n]*[0-9a-zA-Z])[”"]/g, '“$1”')
      .replace(/[‘']([^’'，。、（）“”"\n]*[0-9a-zA-Z])[’']/g, '‘$1’')
      .replace(/\b[A-Za-z]+\b['‘’]\b[A-Za-z]{1,2}\b /g, (m) =>
        toLetterCase(m, 'f').replace(/['‘’]/, "'"),
      ),
    / [A-Z][a-z]+'[a-z]+ /g,
    'l',
  );
}

/* ------------------------------------------------------------------ */
/* rps 规则表（原闭包 `e.rps`）                                          */
/* ------------------------------------------------------------------ */

export const QUOTE_RPS: RpsPair[] = [
  [/[`＇‹›‘’『』]/g, "'"],
  [/'([^\'\n]+)'/g, '‘$1’'],
  [/'/g, '‘'],
  [/^([ 　]*)’/gm, '$1‘'],
  [/：'/g, '：‘'],
  [/‘(。|……|[！？—～]{1,3}|$)$/gm, '’$1'],
  [/[«»‟„〝〞〟［］＂″｢｣“”「」⌈⌋]/g, '"'],
  [/"([^\"\n]+)"/g, '“$1”'],
  [/"/g, '“'],
  [/^([ 　]*)”/gm, '$1“'],
  [/：”/g, '：“'],
  [/“(。|……|[！？—～]{1,3}|$)$/gm, '”$1'],
];

export const transform: Transform = {
  id: 'Quote',
  title: '引号修正',
  description:
    '配对修正中英文引号（直引号→弯引号）；保护英文缩写与引号内的字母数字。',
  run(text: string, _args: string[], _ctx: RunContext): string {
    return safetyAfter(rps(safetyBefore(text), QUOTE_RPS));
  },
};
