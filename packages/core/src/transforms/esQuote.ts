/**
 * ESQuote（原 `_sp.$ESQuote`）：直角引号转弯引号。
 *
 * 语义：`this.rpAt(e.at)`，用共享引号表原序映射：『→‘ 』→’ 「→“ 」→”。
 * 逐行对照 old-core-pretty.js 的 `_sp.$ESQuote = function () { return this.rpAt(e.at); }`。
 */
import type { Transform, RunContext } from '../types';
import { rpAt } from '../utils';
import { quoteAt } from './quoteAt';

export const transform: Transform = {
  id: 'ESQuote',
  title: '直角引号转弯引号',
  description: '『』「」→‘’“”。',
  run(text: string, _args: string[], _ctx: RunContext): string {
    return rpAt(text, quoteAt);
  },
};
