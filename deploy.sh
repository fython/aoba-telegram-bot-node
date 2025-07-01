#!/bin/bash

# 获取 Git 信息
export GIT_COMMIT_HASH=$(git rev-parse HEAD)
export GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "no-tag")
export GIT_COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")
export BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Building with Docker Compose using Git information:"
echo "  Commit Hash: $GIT_COMMIT_HASH"
echo "  Tag: $GIT_TAG"
echo "  Commit Message: $GIT_COMMIT_MESSAGE"
echo "  Build Date: $BUILD_DATE"

# 使用 Docker Compose 构建和启动
docker-compose up --build -d

echo "Docker Compose deployment completed!"
