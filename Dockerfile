# 使用官方 Node.js 镜像作为基础镜像
FROM node:22-alpine AS base

# 定义构建参数
ARG GIT_COMMIT_HASH
ARG GIT_TAG
ARG GIT_COMMIT_MESSAGE
ARG BUILD_DATE

WORKDIR /app

# 安装依赖
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建阶段（可选，如果需要编译 TypeScript）
FROM base AS build

# 如果需要构建，可以在这里添加构建命令
# RUN pnpm build

# 生产阶段
FROM node:22-alpine AS production

# 重新定义构建参数（每个 stage 都需要重新定义）
ARG GIT_COMMIT_HASH
ARG GIT_TAG
ARG GIT_COMMIT_MESSAGE
ARG BUILD_DATE

# 设置环境变量
ENV GIT_COMMIT_HASH=${GIT_COMMIT_HASH}
ENV GIT_TAG=${GIT_TAG}
ENV GIT_COMMIT_MESSAGE=${GIT_COMMIT_MESSAGE}
ENV BUILD_DATE=${BUILD_DATE}

WORKDIR /app

# 安装依赖
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 从构建阶段复制源代码
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig.json ./

# 安装运行时需要的依赖 (tsx)
RUN pnpm add tsx

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 添加版本信息文件
RUN echo "{\
  \"gitCommitHash\": \"${GIT_COMMIT_HASH}\",\
  \"gitTag\": \"${GIT_TAG}\",\
  \"gitCommitMessage\": \"${GIT_COMMIT_MESSAGE}\",\
  \"buildDate\": \"${BUILD_DATE}\"\
}" > /app/version.json

USER nodejs

ENV NODE_ENV=production

CMD ["pnpm", "start"]
