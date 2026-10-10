import type { RunContext, Transform } from '../types';

/**
 * ChapterNumCn：章节括号序号转中文（新增规则，默认关闭，原版没有）。
 *
 * 场景：很多小说用 `(1)` / `(01)` / `（12）` 这类括号序号做章节，
 * 用户希望转成 `第一章：标题` 的中文格式（与 Chapter 规则输出的
 * `第一章：标题` 风格一致）。
 *
 * 只处理行首的括号序号（半角/全角括号均可），数字转中文（1-9999），
 * 标题用全角冒号 `：` 分隔。非整数序号、0 保持原样。
 * 建议放在 Chapter 之后运行。
 */

/** 阿拉伯数字转中文数字（1-9999，标准读法） */
function toChineseNumber(n: number): string {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (!Number.isInteger(n) || n <= 0 || n > 9999) return '';
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n > 10 ? d[n - 10] : '');
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return d[t] + '十' + (o ? d[o] : '');
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (r === 0) return d[h] + '百';
    if (r < 10) return d[h] + '百零' + d[r];
    return d[h] + '百' + toChineseNumber(r);
  }
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  if (r === 0) return d[th] + '千';
  if (r < 100) return d[th] + '千零' + toChineseNumber(r);
  return d[th] + '千' + toChineseNumber(r);
}

const BRACKET_NUM_RE = /^[（(](\d{1,4})[）)][\s　]*(.*)$/;

export const transform: Transform = {
  id: 'ChapterNumCn',
  title: '章节序号转中文',
  description:
    '把 (1)/(01)/（12） 这类括号序号章节转成"第一章：标题"格式（新增规则，默认关闭）',
  run(text: string, _args: string[], _ctx: RunContext): string {
    return text
      .split('\n')
      .map((line) => {
        const m = line.match(BRACKET_NUM_RE);
        if (!m) return line;
        const cn = toChineseNumber(parseInt(m[1], 10));
        if (!cn) return line;
        const title = m[2].trim();
        return title ? `第${cn}章：${title}` : `第${cn}章`;
      })
      .join('\n');
  },
};
