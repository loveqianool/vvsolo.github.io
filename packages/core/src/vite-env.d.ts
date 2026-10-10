/**
 * 仅为 tsc 提供 import.meta.glob 的类型（vitest/vite 在运行时处理它）。
 * 不引入 vite 依赖，保持包的零依赖。
 */
interface ImportMeta {
  glob(
    pattern: string,
    options?: { eager?: boolean; [key: string]: unknown },
  ): Record<string, unknown>;
}
