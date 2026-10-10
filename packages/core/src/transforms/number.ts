import { rpAt } from '../utils';
import type { Transform } from '../types';

/**
 * 原 IIFE 参数 e：全角数字 → 半角数字 的逐字符映射表。
 * 对应原实现 `((_sp.$Number = function () { return this.rpAt(e); })` 。
 */
export const NUMBER_PAIR: [string, string] = ['０１２３４５６７８９', '0123456789'];

export const transform: Transform = {
  id: 'Number',
  title: '全角数字转半角',
  description: '把全角数字 ０-９ 逐字符映射为半角数字 0-9',
  run(text) {
    return rpAt(text, NUMBER_PAIR);
  },
};
