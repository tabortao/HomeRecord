# 作业与积分小程序

这是一个面向小学生的作业与积分管理工具，旨在通过简洁有趣的界面和激励机制，帮助学生培养良好的学习习惯和时间管理能力。

## 项目结构

```
├── backend/           # 后端代码（Python Flask）
│   ├── app.py         # 应用主入口
│   ├── models.py      # 数据库模型
│   ├── api.py         # API路由
│   └── requirements.txt # Python依赖
├── frontend/          # 前端代码
│   ├── index.html     # 主页面
│   ├── js/            # JavaScript文件
│   │   ├── app.js     # 应用主逻辑
│   │   ├── api.js     # API通信
│   │   └── utils.js   # 工具函数
│   └── static/        # 静态资源
│       └── images/    # 图片资源
└── docs/              # 文档
    └── PRD/           # 需求文档
```

## 技术栈

- 前端：HTML、JavaScript、Tailwind CSS
- 后端：Python Flask、SQLite 数据库

## 快速开始

### 1. 安装后端依赖

首先进入backend目录，然后安装所需的Python依赖：

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

在backend目录下运行：

```bash
python app.py
```

后端服务将在 http://localhost:5000 启动。

### 3. 运行前端

由于前端是静态文件，你可以使用任何静态文件服务器来运行。例如，使用Python的内置HTTP服务器：

在frontend目录下运行：

```bash
cd frontend
python -m http.server 8000
```

然后在浏览器中访问 http://localhost:8000。

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

### 小心愿系统
- 内置6个默认心愿
- 自定义心愿添加
- 金币兑换心愿
- 兑换记录查看

### 个人中心
- 用户信息展示
- 荣誉系统（20种荣誉）
- 数据管理（导出、清除）
- 操作记录查看

## 初始账号

系统首次运行时会自动创建一个管理员账号：
- 用户名：admin
- 密码：123456

## 注意事项

1. 本项目使用SQLite数据库，数据存储在backend目录下的homerecord.db文件中。
2. 为了安全起见，生产环境中应该修改SECRET_KEY和管理员密码。
3. 项目支持离线使用（PWA功能），可以添加到主屏幕。
4. 响应式设计，支持在平板和手机等设备上访问。

## 开发说明

1. 项目前后端分离，前端通过API与后端通信。
2. 数据库模型定义在models.py中，包含用户、任务、分类、心愿、操作记录、荣誉等表。
3. 前端使用模块化开发，主要逻辑在app.js中。
4. 图标文件存储在frontend/static/images目录下。

## 许可证

MIT License