/**
 * 长段落检查（只读）：找出超过阈值（默认 300 字）的段落。
 *
 * 场景：从网页复制的小说正文有时段落被合并成超长一段，
 * 列出来人工确认是否需要手动分段。不做自动修改。
 */

export interface LongParaIssue {
  /** 行号（1-based） */
  line: number;
  /** 该段字数 */
  length: number;
  /** 开头预览 */
  preview: string;
}

export function checkLongParagraphs(
  text: string,
  maxLen = 300,
): LongParaIssue[] {
  const issues: LongParaIssue[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.length > maxLen) {
      issues.push({
        line: i + 1,
        length: line.length,
        preview: line.slice(0, 42) + (line.length > 42 ? '…' : ''),
      });
    }
  }
  return issues;
}
