# 使用官方 Node.js 镜像作为基础镜像
FROM node:22-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建阶段（可选，如果需要编译 TypeScript）
FROM base AS build

# 如果需要构建，可以在这里添加构建命令
# RUN pnpm build

# 生产阶段
FROM node:22-alpine AS production

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 从构建阶段复制源代码
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig.json ./

# 安装运行时需要的依赖 (tsx)
RUN pnpm add tsx

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 更改文件所有者
USER nodejs

# 暴露端口（如果需要的话）
# EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动命令
CMD ["pnpm", "start"]
