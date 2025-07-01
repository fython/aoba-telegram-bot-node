#!/bin/bash

# 获取 Git 信息
GIT_COMMIT_HASH=$(git rev-parse HEAD)
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "no-tag")
GIT_COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 镜像名称和标签
IMAGE_NAME="aoba-telegram-bot"
IMAGE_TAG="${GIT_TAG:-latest}"

echo "Building Docker image with Git information:"
echo "  Commit Hash: $GIT_COMMIT_HASH"
echo "  Tag: $GIT_TAG"
echo "  Commit Message: $GIT_COMMIT_MESSAGE"
echo "  Build Date: $BUILD_DATE"
echo "  Image: $IMAGE_NAME:$IMAGE_TAG"

# 构建 Docker 镜像
docker build \
  --build-arg GIT_COMMIT_HASH="$GIT_COMMIT_HASH" \
  --build-arg GIT_TAG="$GIT_TAG" \
  --build-arg GIT_COMMIT_MESSAGE="$GIT_COMMIT_MESSAGE" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  -t "$IMAGE_NAME:$IMAGE_TAG" \
  -t "$IMAGE_NAME:latest" \
  .

echo "Build completed!"
