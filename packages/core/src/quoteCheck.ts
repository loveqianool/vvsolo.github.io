/**
 * checkQuotes：引号配对检查（只读，不修改文本）。
 *
 * 逐行检查以下引号是否成对出现，返回可疑行的行号与说明：
 * - 直引号 `"`、`'`：出现次数为奇数即为可疑
 * - 弯引号 `“”`、`‘’`、直角引号 `「」`、`『』`：左右数量不等即为可疑
 *
 * 注意这是启发式检查（不做跨行配对、不分析嵌套），只负责把可疑行
 * 列出来给人工确认。
 */
export interface QuoteIssue {
  /** 行号（从 1 开始） */
  line: number;
  /** 该行内容（过长截断） */
  text: string;
  /** 说明，如：直引号 " 不成对（3 个） */
  detail: string;
}

const PAIRS: Array<[string, string, string]> = [
  ['“', '”', '弯双引号'],
  ['‘', '’', '弯单引号'],
  ['「', '」', '直角双引号'],
  ['『', '』', '直角单引号'],
];

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

export function checkQuotes(text: string): QuoteIssue[] {
  const issues: QuoteIssue[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const details: string[] = [];

    const dq = countChar(line, '"');
    if (dq % 2 === 1) details.push(`直双引号 " 不成对（${dq} 个）`);
    const sq = countChar(line, "'");
    if (sq % 2 === 1) details.push(`直单引号 ' 不成对（${sq} 个）`);

    for (const [open, close, name] of PAIRS) {
      const o = countChar(line, open);
      const c = countChar(line, close);
      if (o !== c) details.push(`${name}不成对（${open} 开 / ${c} 合）`);
    }

    if (details.length > 0) {
      const short =
        line.length > 60 ? line.slice(0, 60) + '…' : line;
      issues.push({ line: i + 1, text: short, detail: details.join('；') });
    }
  }
  return issues;
}
