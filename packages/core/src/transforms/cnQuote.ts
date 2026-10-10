/**
 * CNQuote（原 `_sp.$CNQuote`）：弯引号转直角引号。
 *
 * 语义：`this.rpAt(e.at.reverse())`——**原地反转共享引号表**后再映射：
 * ‘→『 ’→』 “→「 ”→」。
 * 注意原实现的 quirk：reverse 是原地变异，连续调用时表的方向会来回翻转，
 * 这里原样保留（fixture 即按此行为生成）。
 * 逐行对照 old-core-pretty.js 的 `_sp.$CNQuote = function () { return this.rpAt(e.at.reverse()); }`。
 */
import type { Transform, RunContext } from '../types';
import { rpAt } from '../utils';
import { quoteAt } from './quoteAt';

export const transform: Transform = {
  id: 'CNQuote',
  title: '弯引号转直角引号',
  description: '‘’“”→『』「」。（转直角引号，用于分段排版前的初始化）',
  run(text: string, _args: string[], _ctx: RunContext): string {
    // reverse() 原地反转共享表（原实现的 quirk）；as 断言保持元组类型
    return rpAt(text, quoteAt.reverse() as [string, string]);
  },
};
