# Skill Hub 平台

厦门雅迅智联科技股份有限公司 - 内部技能管理平台

## 部署说明

### 1. 安装 MySQL

```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo mysql -e "CREATE DATABASE skill_hub;"
sudo mysql -e "CREATE USER 'skillhub'@'localhost' IDENTIFIED BY 'skillhub123';"
sudo mysql -e "GRANT ALL PRIVILEGES ON skill_hub.* TO 'skillhub'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### 2. 启动服务

```bash
# 启动后端（端口8080）
cd /home/yaxon/skill-hub/backend
npm start

# 新终端启动前端（端口80）
cd /home/yaxon/skill-hub/frontend
npm run dev
```

### 3. 访问

打开浏览器访问：http://172.16.91.149

## 功能

- 用户注册/登录（JWT认证）
- Skill上传、编辑、删除
- 文件附件上传
- 分类筛选和搜索
- 评论功能
- 用户个人中心

## 技术栈

- 前端：React + Vite + Tailwind CSS
- 后端：Node.js + Express
- 数据库：MySQL
- 认证：JWT