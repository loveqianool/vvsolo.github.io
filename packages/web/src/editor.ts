import { EditorState } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldEffect, foldState, unfoldEffect } from '@codemirror/language';
import {
  highlightSelectionMatches,
  openSearchPanel,
  searchKeymap,
} from '@codemirror/search';

export interface EditorOptions {
  initialValue?: string;
  /** 内容变化回调（防抖由调用方做） */
  onChange?: (text: string) => void;
}

export interface EditorHandle {
  getValue(): string;
  setValue(text: string): void;
  focus(): void;
  /** 在光标处插入文本（替换选中区） */
  insertAtCursor(text: string): void;
  /** 跳到指定行（1-based），并把光标放到行首 */
  gotoLine(line: number): void;
  /** 打开查找替换面板（同 Ctrl+F） */
  openSearch(): void;
  /** 折叠指定区间（from < to），返回实际折叠的区间数 */
  foldRanges(ranges: Array<{ from: number; to: number }>): number;
  /** 展开所有已折叠区间 */
  unfoldAll(): void;
  /** 是否有已折叠区间 */
  isFolded(): boolean;
  /** 按行号取该行起止偏移（1-based） */
  lineRange(line: number): { from: number; to: number };
  /** 文档总行数 */
  lineCount(): number;
  /** 文档总长度（偏移） */
  docLength(): number;
}

/* 中文衬线 + 英文等宽：按字形回退，中文走衬线，ASCII 走等宽 */
const FONT_STACK =
  'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "Courier New", ' +
  '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';

const darkTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: 'var(--text)',
      fontSize: '16px',
    },
    '.cm-content': {
      fontFamily: FONT_STACK,
      lineHeight: '2',
      padding: '16px 0',
      caretColor: 'var(--accent)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--text-faint)',
      border: 'none',
      fontFamily: FONT_STACK,
      fontSize: '13px',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(226,163,78,0.25)' },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(226,163,78,0.32)',
    },
  },
  { dark: true },
);

/** 中文小说友好的 CodeMirror 6：行号 + 自动换行 + 历史 + 搜索 */
export function createEditor(
  el: HTMLElement,
  opts: EditorOptions = {},
): EditorHandle {
  const view = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: opts.initialValue ?? '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        history(),
        foldState,
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        darkTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) opts.onChange?.(update.state.doc.toString());
        }),
      ],
    }),
  });

  /** 取当前实际折叠的区间（从 foldState 查，编辑后位置依然准确） */
  const getFoldedRanges = (): Array<{ from: number; to: number }> => {
    const out: Array<{ from: number; to: number }> = [];
    const field = view.state.field(foldState, false);
    field?.between(0, view.state.doc.length, (from: number, to: number) => {
      out.push({ from, to });
    });
    return out;
  };

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text: string) =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      }),
    focus: () => view.focus(),
    insertAtCursor: (text: string) => {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
    gotoLine: (line: number) => {
      const lineNo = Math.max(1, Math.min(line, view.state.doc.lines));
      const pos = view.state.doc.line(lineNo).from;
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
      view.focus();
    },
    openSearch: () => {
      openSearchPanel(view);
    },
    foldRanges: (ranges) => {
      const valid = ranges.filter((r) => r.to > r.from);
      if (valid.length === 0) return 0;
      view.dispatch({ effects: valid.map((r) => foldEffect.of(r)) });
      return valid.length;
    },
    unfoldAll: () => {
      const folded = getFoldedRanges();
      if (folded.length === 0) return;
      view.dispatch({ effects: folded.map((r) => unfoldEffect.of(r)) });
    },
    isFolded: () => getFoldedRanges().length > 0,
    lineRange: (line) => {
      const ln = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
      return { from: ln.from, to: ln.to };
    },
    lineCount: () => view.state.doc.lines,
    docLength: () => view.state.doc.length,
  };
}
