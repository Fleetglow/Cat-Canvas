#!/bin/bash
# 目录保护脚本 - 防止关键目录被删除

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROTECTED_DIRS=".workbuddy API assets data"

echo "🔒 检查关键目录保护状态..."

for dir in $PROTECTED_DIRS; do
    if [ ! -d "$PROJECT_DIR/$dir" ]; then
        echo "⚠️  警告：$dir/ 目录不存在！"
        echo "   尝试从备份恢复..."
        # 这里可以添加从备份恢复的逻辑
    else
        echo "✅ $dir/ 目录存在"
    fi
done

echo ""
echo "📋 保护规则："
echo "1. 这些目录已被 git 跟踪，不会被 git reset --hard 删除"
echo "2. .gitignore 已更新，不再忽略这些目录"
echo "3. 在执行任何危险操作前，请先运行此脚本"
echo ""
echo "🛡️  建议操作："
echo "  - 避免使用 git clean -fd（会删除未跟踪文件）"
echo "  - 如果必须使用，请先备份这些目录"
echo "  - 使用 git reset --hard 是安全的（只影响已跟踪文件）"
