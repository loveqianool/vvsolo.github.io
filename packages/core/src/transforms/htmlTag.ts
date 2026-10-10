import type { Transform } from '../types';

/**
 * HtmlTag：HTML 标签清理（新增规则，默认关闭）。
 *
 * 场景：从网页复制的小说正文常残留 <p>、<br/>、<div> 等标签。
 * - `<br>` / `<br/>` 转为换行（保留分段语义）；
 * - HTML 注释直接删除；
 * - 其余形如 `<...>` 的标签删除（要求 < 后紧跟字母，避免误伤 `a<b` 这类文本）。
 *
 * 注意放在 HtmlEntity 之后、其他规则之前：标签里可能含实体，且 English
 * 规则会改标签内字母大小写（如 <p> → <P>），必须先清掉。
 */
export const transform: Transform = {
  id: 'HtmlTag',
  title: 'HTML 标签清理',
  description:
    '清除残留的 HTML 标签：<br> 转为换行，注释与其他标签删除（默认关闭，需手动开启）',
  run(text) {
    return text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-zA-Z][^<>]*>/g, '');
  },
};
