import { rpAt } from '../utils';
import { LETTER_PAIR } from './letter';
import { NUMBER_PAIR } from './number';
import type { Transform } from '../types';

/**
 * 原实现 `this.rpAt([e[0] + t[0], e[1] + t[1]])`：
 * 把数字映射表与字母映射表拼接后一次性逐字符映射。
 */
export const transform: Transform = {
  id: 'NumberLetter',
  title: '全角字母数字转半角',
  description: '把全角数字与全角字母统一逐字符映射为半角',
  run(text) {
    return rpAt(text, [
      NUMBER_PAIR[0] + LETTER_PAIR[0],
      NUMBER_PAIR[1] + LETTER_PAIR[1],
    ]);
  },
};
