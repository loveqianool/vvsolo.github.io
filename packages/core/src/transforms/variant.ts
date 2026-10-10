/**
 * Variant：修正变体字母。
 * 对照 old-core-pretty.js 的 `_sp.$Variant`（IIFE 传入的字符映射表，
 * `this.rpAt(e)` 逐字符 1:1 映射）。
 */
import type { Transform } from '../types';
import { rpAt } from '../utils';

/** 变体字母 → 普通字母映射表（字面量由校验脚本逐字节核对 old-core-pretty.js） */
export const VARIANT_PAIR: [string, string] = [
  "ÀÁÂÃÄÅĀАǍⱭàáâãäåāǎɑаßЬЪьъÇçÐÈÉÊËĒĚèéêëēěΗんÌÍÎÏĪǏΙìíîïīǐιМḿмΝÑŃŇИñńňиηÒÓÔÕÖŌǑØОòóôõöōðǒøоÞΡþρΤτÙÚÛÜŪǓǕǗǙǛυùúûüūǔǖǘǚǜⅤⅴνЩщωΥÝŸγýÿ",
  "AAAAAAAAAaaaaaaaaaaaBbbbbCcDEEEEEEeeeeeeHhIIIIIIIiiiiiiiMmmmNNNNNnnnnnOOOOOOOOOooooooooooPPppTtUUUUUUUUUUuuuuuuuuuuuVvvWwwYYYyyy",
];

export const transform: Transform = {
  id: 'Variant',
  title: '修正变体字母',
  description:
    '将 ⓐⒷ、带变音符号的 Àá、异体 Ａ 这类变体字母还原为普通 ASCII 字母。',
  run(text: string): string {
    return rpAt(text, VARIANT_PAIR);
  },
};
