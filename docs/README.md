# 作业与积分小程序

这是一个面向小学生的作业与积分管理工具，旨在通过简洁有趣的界面和激励机制，帮助学生培养良好的学习习惯和时间管理能力。

## 项目结构

```
├── app/                   # 后端代码 (Python Flask) 和前端静态资源
│   ├── api.py             # API 路由定义
│   ├── app.py             # Flask 应用主入口，包含配置、静态文件服务和路由注册
│   ├── models.py          # 数据库模型定义
│   ├── requirements.txt   # Python 依赖
│   ├── script/            # 数据库迁移和数据处理脚本
│   └── static/            # 前端静态资源
│       ├── css/           # CSS 样式文件
│       ├── js/            # JavaScript 文件 (app.js, api.js, utils.js 等)
│       ├── images/        # 图片资源
│       ├── uploads/       # 用户上传文件 (头像、任务图片等)
│       └── index.html     # 应用主页面
├── docs/                  # 项目文档
│   └── PRD/               # 需求文档
└── README.md              # 项目说明文件
```

## 技术栈

- 前端：HTML、JavaScript、Tailwind CSS
- 后端：Python Flask、SQLite 数据库

## 快速开始

### 1. 安装依赖

进入 `app` 目录，然后安装所需的 Python 依赖：

```bash
cd app
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 启动服务

在 `app` 目录下运行：

```bash
python app.py
```

后端服务将在 `http://localhost:5050` 启动，并同时提供前端静态文件服务。在浏览器中访问 `http://localhost:5050` 即可使用。

## 主要功能

### 用户管理
- 注册登录功能
- 子账号管理（管理员功能）
- 权限设置

### 作业打卡
- 任务创建与管理
- 学科分类
- 番茄钟专注功能
- 数据统计（日时长、任务数、金币等）
- 周视图查看
- 任务图片上传与预览

### 小心愿系统
- 内置6个默认心愿
- 自定义心愿添加
- 金币兑换心愿
- 兑换记录查看
- 心愿图片上传与预览

### 个人中心
- 用户信息展示
- 荣誉系统（20种荣誉）
- 数据管理（导出、清除）
- 操作记录查看
- 头像上传与管理


## 注意事项

1. 本项目使用 SQLite 数据库，数据存储在 `app/instance/homerecord.db` 文件中。
2. 为了安全起见，生产环境中应该修改 `SECRET_KEY` 和管理员密码。
3. 项目支持离线使用（PWA功能），可以添加到主屏幕。
4. 响应式设计，支持在平板和手机等设备上访问。

## 开发说明

1. 项目前后端分离，前端通过 API 与后端通信。
2. 数据库模型定义在 `app/models.py` 中，包含用户、任务、分类、心愿、操作记录、荣誉等表。
3. 前端使用模块化开发，主要逻辑在 `app/static/js/app.js` 中。
4. 静态资源（如图片、CSS、JS）由 Flask 后端统一提供服务。

## 许可证

MIT License