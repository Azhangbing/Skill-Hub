#!/bin/bash

echo "===== 启动 Skill Hub 平台 ====="

# 检查MySQL服务
echo "检查MySQL服务..."
if ! systemctl is-active --quiet mysql; then
    echo "请先启动MySQL服务: sudo systemctl start mysql"
    exit 1
fi

# 启动后端
echo "启动后端服务（端口8080）..."
cd /home/yaxon/skill-hub/backend
npm start &
BACKEND_PID=$!
echo "后端进程ID: $BACKEND_PID"

# 等待后端启动
sleep 3

# 启动前端
echo "启动前端服务（端口80）..."
cd /home/yaxon/skill-hub/frontend
npm run dev &
FRONTEND_PID=$!
echo "前端进程ID: $FRONTEND_PID"

echo ""
echo "===== Skill Hub 已启动 ====="
echo "访问地址: http://172.16.91.149"
echo ""
echo "按Ctrl+C停止服务"

# 等待
wait