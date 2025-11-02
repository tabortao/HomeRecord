# 后端服务构建阶段
FROM python:3.9-slim AS backend

# 设置工作目录
WORKDIR /app/backend

# 复制后端依赖文件
COPY backend/requirements.txt .

# 安装后端依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# 暴露后端服务端口
EXPOSE 5000

# 启动后端服务
CMD ["python", "app.py"]

# 前端服务构建阶段
FROM python:3.9-slim AS frontend

# 设置工作目录
WORKDIR /app/frontend

# 复制前端代码
COPY frontend/ .

# 暴露前端服务端口
EXPOSE 8000

# 启动前端服务（使用Python的HTTP服务器）
CMD ["python", "-m", "http.server", "8000"]