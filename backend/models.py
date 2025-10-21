from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import hashlib

# 创建数据库实例
db = SQLAlchemy()

# 用户表
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    nickname = db.Column(db.String(50))  # 昵称
    phone = db.Column(db.String(20))  # 手机号
    avatar = db.Column(db.String(100), default='default.svg')  # 头像
    
    # 已在文件开头定义了set_password和check_password方法，这里不再重复
    role = db.Column(db.String(20), default='user')  # admin或user
    permissions = db.Column(db.Text, default='{}')  # JSON格式存储权限设置
    total_gold = db.Column(db.Integer, default=0)
    total_tomato = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    # 关系定义
    tasks = db.relationship('Task', backref='user', lazy=True)
    categories = db.relationship('TaskCategory', backref='user', lazy=True)
    wishes = db.relationship('Wish', backref='user', lazy=True)
    logs = db.relationship('OperationLog', backref='user', lazy=True)
    honors = db.relationship('UserHonor', backref='user', lazy=True)

# 任务表
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    series_id = db.Column(db.String(50))  # 循环任务系列ID
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(100))
    category = db.Column(db.String(50), nullable=False)
    planned_time = db.Column(db.Integer, default=10)  # 默认10分钟
    actual_time = db.Column(db.Integer, default=0)
    points = db.Column(db.Integer, default=1)  # 可以为负数，表示惩罚
    repeat_setting = db.Column(db.String(50), default='无')
    start_date = db.Column(db.String(20), nullable=False)
    end_date = db.Column(db.String(20))
    status = db.Column(db.String(20), default='未完成')  # 已完成、待完成、未完成
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    remark = db.Column(db.Text)

# 任务分类表
class TaskCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # 自定义分类关联用户，内置分类不关联
    name = db.Column(db.String(50), unique=True, nullable=False)
    color = db.Column(db.String(20), default='#999999')
    is_builtin = db.Column(db.Boolean, default=False)

# 心愿表
class Wish(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # 自定义心愿关联用户，内置心愿不关联
    name = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text)
    icon = db.Column(db.String(100))
    cost = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(20))
    exchange_count = db.Column(db.Integer, default=0)
    is_builtin = db.Column(db.Boolean, default=False)

# 操作记录表
class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    operation_type = db.Column(db.String(50), nullable=False)
    operation_content = db.Column(db.Text, nullable=False)
    operation_time = db.Column(db.DateTime, default=datetime.now)
    operation_result = db.Column(db.String(20), default='成功')

# 荣誉表
class Honor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    condition = db.Column(db.Text)
    
    # 关系定义
    user_honors = db.relationship('UserHonor', backref='honor', lazy=True)

# 用户荣誉表
class UserHonor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    honor_id = db.Column(db.Integer, db.ForeignKey('honor.id'), nullable=False)
    obtained_at = db.Column(db.DateTime, default=datetime.now)
    obtained_count = db.Column(db.Integer, default=1)