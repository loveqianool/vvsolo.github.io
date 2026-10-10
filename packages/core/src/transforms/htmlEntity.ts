/**
 * HtmlEntity：修正 HTML 字符实体。
 * 对照 old-core-pretty.js 的 `_sp.$HtmlEntity`。
 *
 * 原实现用 `document.createElement('div')` + innerHTML 做解码；core 是零 DOM 的，
 * 改用 `entities` 包的 `decodeHTML`（与 fixture 生成时 mock document 用的
 * 恰好是同一实现，因此 fixture 行为完全一致）。
 *
 * 已知与真实浏览器 innerHTML 的差异（见文件末尾注释）：
 * - 浏览器对畸形实体（如 `&amp` 无分号、`&#xZZ;` 非法码位）的容错更激进，
 *   decodeHTML 偏严格，部分畸形输入解码结果可能不同；
 * - 浏览器会把 `\r` 等做换行规范化，decodeHTML 不会。
 * 这些差异只影响畸形输入，正常实体两者一致。
 */
import { decodeHTML } from 'entities';
import type { Transform } from '../types';

export const transform: Transform = {
  id: 'HtmlEntity',
  title: '修正 HTML 字符实体',
  description:
    '将 &amp;、&#20013;、&#x6587;、&nbsp; 这类 HTML 字符实体解码为实际字符。',
  run(text: string): string {
    return decodeHTML(
      text.replace(/[&＆]\b([a-zA-Z][a-zA-Z1-8]{1,30})\b[;；]/g, '&$1;'),
    ).replace(/[&＆][Aa]mp[;；]/g, '&');
  },
};
