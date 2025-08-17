# Aoba Telegram Bot - AI Coding Agent Instructions

## Architecture Overview

This is a TypeScript Telegram bot built on **Telegraf** with **PostgreSQL** + **Kysely ORM**. The core pattern is:
- **Feature-driven architecture**: Each feature is self-contained in `src/features/` and self-registers via `src/registry.ts`
- **Enhanced context pattern**: `AobaContext` extends Telegraf's context with database, logger, config, and utilities
- **Auto-discovery**: Features are imported in `src/index.ts` to trigger registration side effects

## Critical Development Workflow

### Adding New Features
1. **Always start with documentation**: Create `docs/features/{feature}.md` following the pattern in `docs/features/choose.md`
2. **Feature registration pattern**: Use `registerCommand()`, `onBotInit()`, or `registerInlineQueryHandler()` from `src/registry.ts`
3. **Import to activate**: Add feature import to `src/index.ts` initFeatureImports() array
4. **Database changes**: Add migrations to `src/database/migrations/` following the naming pattern `YYYYMMDD_feature.ts`

### Key Commands
- `pnpm dev` - Development with auto-reload using tsx watch
- `pnpm start` - Production start
- `pnpm lint:fix` - Auto-fix ESLint issues

## Project-Specific Patterns

### Context Enhancement Pattern
Every feature receives `AobaContext` with pre-configured:
```typescript
ctx.logger // Pino logger with user context
ctx.db     // Kysely database instance
ctx.config // JSON config from AOBA_CONFIG_PATH
ctx.urlCleaner // URL tracking cleaner utility
ctx.userDisplay // Formatted user display name
```

### Feature Registration Pattern
Features self-register through side effects:
```typescript
// In src/features/example.ts
import { registerCommand } from '../registry';

registerCommand({
  command: 'example',
  shortDesc: 'Brief description',
  longDesc: 'Detailed help text',
  handler: async (ctx) => {
    ctx.logger.info('Command executed');
    // Feature logic here
  }
});
```

### Database Pattern
- **Kysely ORM** with typed models in `src/database/models.ts`
- Migrations auto-run on startup via `migrator.migrateToLatest()`
- Access via `ctx.db` in handlers: `ctx.db.selectFrom('table').execute()`

### Logging Pattern
Always use contextual logging: `ctx.logger.info()` includes user info automatically. Child loggers for features:
```typescript
ctx.logger = ctx.logger.child({ feature: 'repeat' });
```

## Configuration System

Environment variables:
- `AOBA_BOT_TOKEN` - Telegram bot token (required)
- `AOBA_CONFIG_PATH` - JSON config file path (default: `./config.json`)
- `AOBA_FEATURE_*_DISABLED=1` - Disable specific features
- Postgres connection via `POSTGRES_*` vars

Config structure follows `AobaConfigObj` interface with feature-specific settings under `features.*`.

## Integration Points

### Database Schema
Core tables: `yulu_record`, `repeat_message`, `repeat_cooldown`, `ai_chat_messages`. Always use Kysely types from `src/database/models.ts`.

### URL Cleaning
Automatic URL tracking parameter removal via `ctx.urlCleaner` - configured per-chat with custom rules in config.

### Message Processing
- **Middleware chain**: `prepareMiddleware()` adds user context and logger setup
- **Error handling**: Global catch logs errors with user/chat context
- **Inline queries**: Register handlers via `registerInlineQueryHandler()`

## Docker Deployment

Uses multi-service setup: app + postgres + watchtower for auto-updates. Build args inject git metadata for version tracking.

## Code Quality

- **ESLint + Prettier** with TypeScript rules
- **Import sorting** via @trivago/prettier-plugin-sort-imports
- **Type safety**: Strict TypeScript with Telegraf and Kysely types
- **pnpm** package manager (lockfile committed)
