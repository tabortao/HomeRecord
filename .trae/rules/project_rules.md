# 项目规则

本小程序是一个面向小学生的作业与积分管理工具，旨在通过简洁有趣的界面和激励机制，帮助学生培养良好的学习习惯和时间管理能力。系统采用前后端分离架构，前端使用 HTML、JavaScript 和 Tailwind CSS 构建，后端使用 Python Flask 框架和 SQLite 数据库。

- 项目开发、调试时，均需要先阅读理解`docs\PRD\完整需求文档.md`。
- 网页图标采用`frontend\static\images\favicon`。
- 其他静态文件（如图片、字体等）均存储在`frontend\static`目录下。

## 后端设计要求

- 创建虚拟环境，然后在虚拟环境中安装依赖。`cd backend; .\venv\Scripts\activate; pip install -r requirements.txt `。
- 启动后端服务，运行`cd backend; .\venv\Scripts\activate; python app.py`。
- 后端采用 Python Flask 框架，数据库采用 SQLite。
- 所有 API 路由均存储在`backend\api.py`文件中。
- 测试账号：
  - 用户名：testuser
  - 密码：Testuser123

## 前端设计要求

- js 文件按功能进行分类，每个 js 文件负责实现一个或多个功能模块。
- 每个 js 文件的文件名应与其所实现的功能模块相关，采用驼峰命名法。
- 所有 js 文件均存储在`frontend\js`目录下。
- 启动前端服务，运行`cd frontend; python -m http.server 8000`。
