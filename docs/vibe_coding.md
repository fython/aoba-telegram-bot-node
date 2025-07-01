# Vibe Coding

本项目推荐尝试使用 Agent 进行 Vibe Coding 开发机器人，本文会提供一些建议给人类以及 Agent。

## 了解基本架构

本项目基于许多可靠和成熟的框架和库来构建起机器人服务，并且定制了一些代码组织模式，当你在开发新功能时，请尽量遵守原有的框架和模式，在能力边界内开发功能。

依赖框架和库：

- Node.js/TypeScript/pnpm : 我们的语言和运行时根基
- ESLint/Prettier : 让我们的代码质量更好更漂亮，统一风格，避免重复提交与文档或逻辑无关的变化
- Pino : 日志库
- Telegraf : Telegram 机器人框架
- pg/kysely : PostgresQL 以及 ORM 框架
- tsx : 直接运行 TypeScript 代码

代码组织：

- `src/registry.ts` : 统一机器人命令/Inline 查询/文本事件处理注册过程
- `src/logger.ts` : 日志单例
- `src/database` : Postgres 数据库
- `src/features` : 功能特性，每份特性代码（.ts）都通过 `src/registry.ts` 暴露的接口注册功能，最后在 `src/index.ts` 通过 import 引入特性
- 省略

## 如何开发一个新功能

1. 在 Git 中创建新的特性分支，并 checkout 到新分支
2. 在 [docs/features](docs/features) 目录下创建一个 Markdown 文件，可以参照 [choose.md](docs/features/choose.md) 的格式
3. 在 Agent 中要求 AI 根据这份 Markdown 开发对应的功能逻辑
   参考问题：
   ```text
   根据 docs/features/choose.md 生成功能 src/features/choose.ts，并注册到 src/index.ts 的 import 表达式中
   ```
4. 验证功能逻辑是否正常
5. 提交新分支到 Git 远端仓库，发起 Pull Request 请求 Code review
