/**
 * 有状态的 mask 单例：对照 old-core-pretty.js 里
 * `Object.assign(_sp, ((r, a) => {...})({}, -1))` 的闭包实现。
 *
 * - `r`/`maskTable`、`a`/`maskCounter` 在 maskSep / maskQuote / maskLetter /
 *   maskRestore 之间**全局共享**（原实现即如此），maskRestore 不清空状态。
 * - 单独抽成模块而不是各 transform 文件闭包：原 pipeline（如 cleanup）里
 *   English 打的 mask 是由 Finish 的 safetyAfter → maskRestore 统一还原的，
 *   共享状态是 pipeline fixture 语义正确的前提。
 * - `in` 判断与 `{}` 字面量：与原实现一致（包括原型链属性的边界行为）。
 */
import { getReg } from './utils';
import { internalConfig } from './config';
import { rpAt, toLetterCase, matchLetterCase } from './utils';

const maskTable: Record<string, string> = {};
let maskCounter = -1;

/** 原 IIFE 里的 `e(t)` 工厂：n 为函数时先映射再查表，否则直接查表 */
function maskWith(mapFn: ((m: string) => string) | null) {
  const isFn = typeof mapFn === 'function';
  return (s: string, re: RegExp): string =>
    s.replace(re, (m) => {
      const key = isFn ? (mapFn as (x: string) => string)(m) : m;
      if (!(key in maskTable)) maskTable[key] = `〔☯${++maskCounter}〕`;
      return maskTable[key];
    });
}

/** 原 `maskSep` */
export const maskSep = maskWith((m) =>
  rpAt(m, ['。“”『』‘’「」', '.""""\'\'\'\'']),
);

/** 原 `maskQuote`：注意 〔☯22〕/〔☯27〕 是写死的占位，不是计数器编号 */
export const maskQuote = maskWith((m) =>
  m.replace(/[“”「」"]/g, '〔☯22〕').replace(/[‘’『』']/g, '〔☯27〕'),
);

/** 原 `maskLetter` */
export const maskLetter = maskWith((m) =>
  m.replace(/[＆]/g, '&').replace(/[；]/g, ';'),
);

/** 原 `maskRestore`：按插入顺序逐个还原，最后处理 22/27 写死占位 */
export function maskRestore(s: string): string {
  let out = s;
  for (const k in maskTable) out = out.replace(getReg(maskTable[k], 'g'), k);
  return out.replace(/〔☯22〕/g, '"').replace(/〔☯27〕/g, "'");
}

/** 原 `safetyBefore`（Quote transform 用） */
export function safetyBefore(s: string): string {
  return maskQuote(
    maskQuote(
      maskSep(maskSep(s, internalConfig.enSep), internalConfig.rCoord),
      /[“"]([0-9a-zA-Z]+)[”"]/g,
    ),
    /[‘']([0-9a-zA-Z]+)[’']/g,
  );
}

/** 原 `safetyAfter`（Finish transform 用） */
export function safetyAfter(s: string): string {
  return matchLetterCase(
    maskRestore(s)
      .replace(/[“"]([^”"，。\n]*[0-9a-zA-Z])[”"]/g, '“$1”')
      .replace(/[‘']([^’'，。、（）“”"\n]*[0-9a-zA-Z])[’']/g, '‘$1’')
      .replace(/\b[A-Za-z]+\b[\\'‘’]\b[A-Za-z]{1,2}\b /g, (m) =>
        toLetterCase(m, 'f').replace(/[\\'‘’]/, "'"),
      ),
    / [A-Z][a-z]+'[a-z]+ /g,
    'l',
  );
}
