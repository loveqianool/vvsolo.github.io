/**
 * Unicode：修正 Unicode 转义。
 * 对照 old-core-pretty.js 的 `_sp.$Unicode`。
 *
 * 原实现以 `this.conv("NumberLetter")` 开头（先把全角数字字母转半角，
 * 否则 `＆＃20013；` 这类全角实体头匹配不上）。新架构里 pipeline 也会
 * 单独跑 NumberLetter 步骤（幂等），这里内联同样映射以保证 transform
 * 独立调用时与原 `$Unicode` 行为一致。
 */
import type { Transform } from '../types';
import { rpAt } from '../utils';

/** 内联的 conv("NumberLetter")：全角数字字母 → 半角（字面量由校验脚本逐字节核对） */
/** 字面量校验用，对照 old-core-pretty.js */
export const NUMBER_LETTER_PAIR: [string, string] = [
  "０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
];

function applyNumberLetter(s: string): string {
  return rpAt(s, NUMBER_LETTER_PAIR);
}

export const transform: Transform = {
  id: 'Unicode',
  title: '修正 Unicode 转义',
  description:
    '将 \\u4e2d、\\x41、&#x6587;、%E4%B8%AD、0x4e2d 这类 Unicode/URL/十六进制转义还原为实际字符。',
  run(text: string): string {
    return (
      applyNumberLetter(text)
        // &[#＃﹟]数字 / &[#＃﹟]xXXXX（允许全角 ＆＃ 与省略分号）
        .replace(
          /[＆&][﹟＃#]\b(?:[xX][\da-fA-F]{4}|\d+)\b[；;]?/g,
          (m) => {
            let t = m.replace(/[＆&﹟＃#xX；;]/g, '');
            if (m.search(/[＆&]#[xX]/) > -1) t = '0x' + t;
            return String.fromCharCode(Number(t));
          },
        )
        // \x41 \u4e2d \U4e2d \41
        .replace(/\\\b(?:[xX][\da-fA-F]{2}|[uU]?[\da-fA-F]{4})\b/g, (m) =>
          String.fromCharCode(
            Number('0x' + m.replace(/[\\xXuU；;]/g, '')),
          ),
        )
        // 0x4e2d（4~6 位十六进制）
        .replace(/\b(?:0[xX][\da-fA-F]{4,6})\b/g, (m) =>
          String.fromCodePoint(Number(m.toLowerCase())),
        )
        // %E4%B8%AD（URL 编码，非法时保留原文）
        .replace(/(?:[％%]\b[\da-fA-F]{2})+\b/g, (m) => {
          try {
            return decodeURIComponent(m);
          } catch {
            return m;
          }
        })
    );
  },
};
