/**
 * Char（原 `_sp.$Char`）：混合字符修正。
 *
 * 语义：`this.rpHooks([...7 组 hook...])`。每组 hook 先用 hit 正则找出
 * "疑似数字/编号/单位混合串"的片段（全数字片段、命中 skip、缺 need 的跳过），
 * 再对片段跑 rpHook：at 字符表映射（如 。→.）、rps（如多余小数点收尾）、
 * rp 单次替换、lc 大小写。
 * 逐行对照 old-core-pretty.js 的 `((e) => { _sp.$Char ... })([...])`。
 */
import type { Transform, RunContext } from '../types';
import { commReg } from '../common';
import { rpHooks, type HookDef } from '../utils';

/** 第 1 组 hook 的 hit 模板原文（commReg 展开 `{$ofwPun}` 后使用） */
export const CHAR_HIT1_SRC =
  '\\b[a-zA-Z]*[0-9。\\.]+\\w*[{$ofwPun}]?(?:[。·.：〉〈＊，—＋－＝＞＜～><]{1,2}\\b[0-9。\\.]+\\w*[{$ofwPun}]?)+';

export const CHAR_HOOKS: HookDef[] = [
  {
    hit: commReg(CHAR_HIT1_SRC, 'g'),
    at: ['。·.：〉〈＊—＋－＝＞＜～', '...:><×-+-=><~'],
    rps: [
      [/\.($|”)/g, '。$1'],
      [/([a-zA-Z])\.(?=\d)/g, '$1。'],
    ],
  },
  {
    hit: [
      /\b[0-9a-zA-Z]+(?:[~～－—\-]{1,4}[0-9a-zA-Z]+){1,2}\b/g,
      /[－—\-]{1,2}\b\d+\b/g,
    ],
    rps: [
      [/[－—\-]+/g, '-'],
      [/[~～]+/g, '~'],
    ],
  },
  {
    hit: [
      /\b\d+(?:\.\d+)?\b(\W{0,3})[~～－–—\-]{1,4}\b\d+(?:\.\d+)?\b\1/g,
      /\+—/g,
    ],
    at: ['－–—~', '---～'],
    rps: [
      [/\-+/, '-'],
      [/～～+/, '～'],
    ],
  },
  {
    hit: [
      /\b(?:\d{1,3}(?:[,，]\d{1,3}){1,3}[。\.]\d{1,8}|\d{1,3}(?:[,，]\d{1,3}){1,3}|\d{1,18}[。\.]\d{1,8}|(?:[1-9]|[1-9]\d|1\d{2}|25[0-5]|2[0-4]\d)(?:[。\.](?:\d|[1-9]\d|1\d{2}|25[0-5]|2[0-4]\d)){3})\b/g,
      /\b(?:[A-Z][\.．。]){2,4}/g,
      /^\d{1,2}。/gm,
    ],
    skip: /\b(?:\d+，\d{1,2}|\d+(?:，\d+){2,}|[1-9]\d+。\d{3})\b/,
    at: ['，。．', ',..'],
  },
  { hit: /\b(?:[A-Z]\.){2,4}(?=[’”』」]|\n)/g, rp: [/\.$/, '。'] },
  {
    hit: /\b(?:No|Top|Lv|Level)\b。\b\d{1,5}\b/g,
    lc: 'u',
    rp: [/。/, '.'],
  },
  { hit: /[,.]\n/g, at: [',.', '，。'] },
];

export const transform: Transform = {
  id: 'Char',
  title: '混合字符修正',
  description:
    '数字编号、范围符号（～/—）、千分位、IP/缩写中的中英文标点归一。',
  run(text: string, _args: string[], _ctx: RunContext): string {
    return rpHooks(text, CHAR_HOOKS);
  },
};
