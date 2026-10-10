/**
 * Finish（原 `_sp.$Finish`）：排版收尾。
 *
 * 语义：`this.safetyAfter().replace(...)...` —— 先还原保护占位、规范英文
 * 引号与大小写，再压缩多余空格空行并整理首尾换行。
 * 逐行对照 old-core-pretty.js 的 `_sp.$Finish`。
 *
 * mask 状态使用共享模块 `../masks`（与原实现里 maskSep/maskQuote/maskLetter/
 * maskRestore 共用同一闭包一致）：pipeline 里 English 打上的 `〔☯N〕` 占位
 * 由这里的 safetyAfter → maskRestore 统一还原。
 */
import { safetyAfter } from '../masks';
import type { Transform } from '../types';

export const transform: Transform = {
  id: 'Finish',
  title: '排版收尾',
  description: '还原保护占位、规范英文引号与大小写、压缩多余空格空行并整理首尾换行',
  run(text) {
    // 原实现：
    // `this.safetyAfter().replace(/  +/g, " ").replace(/\n\n\n+/g, "\n\n")
    //      .replace(/^\n+/, "").replace(/\n\n+$/, "\n")`
    return safetyAfter(text)
      .replace(/  +/g, ' ')
      .replace(/\n\n\n+/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n\n+$/, '\n');
  },
};
