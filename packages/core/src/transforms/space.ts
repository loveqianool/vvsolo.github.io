import { commFmt } from '../common';
import type { Transform } from '../types';

/**
 * 原 `$Space` 的字符组模板（`"[{$han}{$fwPun}{$qfwPun}{$ofwPun}&\\x2f\\x5c]".commFmt()`）：
 * 汉字、全角标点、成对全角标点、其他全角符号，以及 & / \\ 。
 * 注意模板里的 `\\x2f` / `\\x5c` 在正则里是转义序列，分别表示 `/` 与 `\\`。
 */
const SPACE_CLASS = commFmt('[{$han}{$fwPun}{$qfwPun}{$ofwPun}&\\x2f\\x5c]');

export const transform: Transform = {
  id: 'Space',
  title: '修正汉字空格',
  description: '删除汉字、全角标点及 &、/、\\ 左右两侧的多余半角空格',
  run(text) {
    // 原实现：`this.replace(new RegExp(` +${e}|${e} +`, "g"), (e) => e.trim())`
    return text.replace(new RegExp(` +${SPACE_CLASS}|${SPACE_CLASS} +`, 'g'), (m) =>
      m.trim(),
    );
  },
};
