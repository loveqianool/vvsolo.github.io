export interface TypesetConfig {
  linenum: number;
  separator: string;
  textSeparator: string;
}
export const defaultConfig: TypesetConfig = {
  linenum: 35,
  separator: '＊＊＊　　＊＊＊　　＊＊＊',
  textSeparator: '＊'.repeat(35),
};
export interface RunContext {
  config: TypesetConfig;
  onStep?: (stepId: string, index: number, total: number) => void;
}
export interface Transform {
  id: string;
  title: string;
  description: string;
  run(text: string, args: string[], ctx: RunContext): string;
}
export interface Step {
  id: string;
  args?: string[];
  enabled?: boolean;
}
export type PipelineId = 'cleanup' | 'cleanupEx' | 'typesetSplit' | 'typesetRead';
