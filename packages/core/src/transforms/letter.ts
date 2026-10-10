import { rpAt } from '../utils';
import type { Transform } from '../types';

/**
 * 原 IIFE 参数 t：全角字母 → 半角字母 的逐字符映射表。
 * 对应原实现 `((_sp.$Letter = function () { return this.rpAt(t); })` 。
 */
export const LETTER_PAIR: [string, string] = [
  'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
];

export const transform: Transform = {
  id: 'Letter',
  title: '全角字母转半角',
  description: '把全角字母 Ａ-Ｚａ-ｚ 逐字符映射为半角字母 A-Za-z',
  run(text) {
    return rpAt(text, LETTER_PAIR);
  },
};
