# 小说排版助手（重写版）

[vvsolo.github.io](https://github.com/vvsolo/vvsolo.github.io)「排版助手（在线版）」的 TypeScript 重写。

原站功能完整复刻（排版规则与旧版逐字一致，600+ 组回归测试锁定），另加：

- **Diff 预览**：每次排版先并排预览改动，确认后再应用
- **规则可配置**：一键整理的每条规则可开关/单步运行，配置可导出导入 JSON
- **Worker**：排版在 Web Worker 里跑，大文本不卡界面，带进度条
- **CodeMirror 6** 编辑器、草稿自动保存（localStorage）、简繁转换、快捷键（F7/F8/F9/F10）

## 结构

```
packages/core   纯排版引擎（零 DOM 依赖，可独立发布为 npm 包）
  src/transforms/   18 条排版规则，每条一个模块 { id, title, description, run }
  src/pipelines.ts  四个主流程：一键整理 / 特殊整理 / 分段排版 / 阅读排版
  src/masks.ts      跨规则共享的 mask 单例（与原实现语义一致）
  test/             回归测试（由旧版引擎实测生成的 input→output）
packages/web    Web 应用（Vite + CodeMirror 6 + Worker + diff + 规则面板）
```

## 开发

```bash
npm install                   # 根目录一次装完所有 workspace 依赖
npm run dev -w @typeset/web   # 开发服务器
npm test                      # 所有测试（含旧版行为回归）
npm run build -w @typeset/web # 构建，产物在 packages/web/dist
```

## 部署

GitHub Actions 自动构建部署：`.github/workflows/pages.yml` 在每次 push 到 `master` 时
构建 `packages/web` 并发布到 Pages。仓库 Settings → Pages → Source 选 **GitHub Actions**。

## 致谢

排版规则源自 [vvsolo](https://github.com/vvsolo/vvsolo.github.io) 的排版助手；
简繁转换感谢 OpenCC。
