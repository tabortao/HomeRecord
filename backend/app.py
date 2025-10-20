from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User, Task, TaskCategory, Wish, OperationLog, Honor, UserHonor
import json
import os
from datetime import datetime, timedelta
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///homerecord.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)

# 初始化数据库
with app.app_context():
    db.create_all()
    # 检查是否已有管理员用户，如果没有则创建
    if not User.query.first():
        admin = User(username='admin', password='123456', role='admin', total_gold=0, total_tomato=0)
        db.session.add(admin)
        db.session.commit()
    
    # 初始化内置任务分类
    categories = [
        {'name': '语文', 'color': '#FF6B6B', 'is_builtin': True},
        {'name': '数学', 'color': '#4ECDC4', 'is_builtin': True},
        {'name': '英语', 'color': '#45B7D1', 'is_builtin': True},
        {'name': '劳动', 'color': '#96CEB4', 'is_builtin': True},
        {'name': '生活', 'color': '#FFEAA7', 'is_builtin': True},
        {'name': '兴趣', 'color': '#DDA0DD', 'is_builtin': True},
        {'name': '表扬', 'color': '#77DD77', 'is_builtin': True},
        {'name': '批评', 'color': '#FF6347', 'is_builtin': True},
        {'name': '独立', 'color': '#87CEEB', 'is_builtin': True},
        {'name': '惩罚', 'color': '#FFA07A', 'is_builtin': True}
    ]
    for category in categories:
        if not TaskCategory.query.filter_by(name=category['name'], is_builtin=True).first():
            new_category = TaskCategory(**category)
            db.session.add(new_category)
    
    # 初始化内置心愿
    wishes = [
        {'name': '看电视', 'content': '可以看喜欢的电视节目', 'icon': '看电视.png', 'cost': 1, 'unit': '分钟', 'exchange_count': 0, 'is_builtin': True},
        {'name': '零花钱', 'content': '获得额外的零花钱', 'icon': '零花钱.png', 'cost': 3, 'unit': '元', 'exchange_count': 0, 'is_builtin': True},
        {'name': '玩平板', 'content': '可以玩平板电脑', 'icon': '玩平板.png', 'cost': 1, 'unit': '分钟', 'exchange_count': 0, 'is_builtin': True},
        {'name': '玩手机', 'content': '可以玩手机', 'icon': '玩手机.png', 'cost': 1, 'unit': '分钟', 'exchange_count': 0, 'is_builtin': True},
        {'name': '玩游戏', 'content': '可以玩电子游戏', 'icon': '玩游戏.png', 'cost': 1, 'unit': '分钟', 'exchange_count': 0, 'is_builtin': True},
        {'name': '自由活动', 'content': '可以自由支配时间', 'icon': '自由活动.png', 'cost': 1, 'unit': '分钟', 'exchange_count': 0, 'is_builtin': True}
    ]
    for wish in wishes:
        if not Wish.query.filter_by(name=wish['name'], is_builtin=True).first():
            new_wish = Wish(**wish)
            db.session.add(new_wish)
    
    # 初始化荣誉系统
    honors = [
        {'name': '连续打卡 7 天', 'description': '连续7天完成所有任务', 'condition': '连续打卡7天'},
        {'name': '学习达人', 'description': '单日学习时长超过3小时', 'condition': '单日学习时长>180分钟'},
        {'name': '阅读之星', 'description': '累计阅读时间超过10小时', 'condition': '累计阅读时间>600分钟'},
        {'name': '早起鸟', 'description': '连续7天早上完成任务', 'condition': '连续7天早上完成任务'},
        {'name': '坚持到底', 'description': '连续完成同一任务30天', 'condition': '连续完成同一任务30天'},
        {'name': '全能选手', 'description': '单日完成所有学科任务', 'condition': '单日完成所有学科任务'},
        {'name': '进步神速', 'description': '任务完成率提升20%', 'condition': '任务完成率提升20%'},
        {'name': '专注达人', 'description': '单次学习时长超过1小时', 'condition': '单次学习时长>60分钟'},
        {'name': '周末战士', 'description': '周末完成任务数量超过10个', 'condition': '周末完成任务数>10'},
        {'name': '积分富翁', 'description': '累计获得积分超过1000', 'condition': '累计积分>1000'},
        {'name': '心愿达人', 'description': '兑换心愿次数超过20次', 'condition': '兑换心愿次数>20'},
        {'name': '计划大师', 'description': '创建循环任务超过10个', 'condition': '创建循环任务数>10'},
        {'name': '完美主义', 'description': '任务完成率达到100%', 'condition': '任务完成率=100%'},
        {'name': '持之以恒', 'description': '使用番茄钟超过100次', 'condition': '使用番茄钟次数>100'},
        {'name': '时间管理', 'description': '任务实际用时与计划用时相差不超过10%', 'condition': '任务时间误差<10%'},
        {'name': '学科之星', 'description': '某一学科连续完成任务15天', 'condition': '某学科连续完成15天'},
        {'name': '高效学习', 'description': '单日番茄钟专注时长超过2小时', 'condition': '单日番茄钟时长>120分钟'},
        {'name': '勤奋努力', 'description': '连续30天有打卡记录', 'condition': '连续30天有打卡'},
        {'name': '任务高手', 'description': '单日完成任务数量超过15个', 'condition': '单日完成任务数>15'},
        {'name': '成长先锋', 'description': '累计获得10种不同的荣誉', 'condition': '获得10种不同荣誉'}
    ]
    for honor in honors:
        if not Honor.query.filter_by(name=honor['name']).first():
            new_honor = Honor(**honor)
            db.session.add(new_honor)
    
    db.session.commit()

# 用户相关路由
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if user and user.password == password:
        return jsonify({'success': True, 'user': {'id': user.id, 'username': user.username, 'role': user.role}})
    return jsonify({'success': False, 'message': '用户名或密码错误'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': '用户名已存在'})
    
    # 检查是否是第一个用户
    if not User.query.first():
        role = 'admin'
    else:
        role = 'user'
    
    new_user = User(username=username, password=password, role=role, total_gold=0, total_tomato=0)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'success': True, 'user': {'id': new_user.id, 'username': new_user.username, 'role': new_user.role}})

# 任务相关路由
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    user_id = request.args.get('user_id')
    date = request.args.get('date')
    category = request.args.get('category')
    
    query = Task.query.filter_by(user_id=user_id)
    
    if date:
        query = query.filter_by(start_date=date)
    if category and category != '全部学科':
        query = query.filter_by(category=category)
    
    tasks = query.all()
    result = []
    for task in tasks:
        result.append({
            'id': task.id,
            'name': task.name,
            'description': task.description,
            'icon': task.icon,
            'category': task.category,
            'planned_time': task.planned_time,
            'actual_time': task.actual_time,
            'points': task.points,
            'repeat_setting': task.repeat_setting,
            'start_date': task.start_date,
            'end_date': task.end_date,
            'status': task.status,
            'series_id': task.series_id
        })
    
    return jsonify(result)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    user_id = data.get('user_id')
    
    # 创建任务
    task = Task(
        user_id=user_id,
        name=data.get('name'),
        description=data.get('description'),
        icon=data.get('icon') or 'default.png',
        category=data.get('category'),
        planned_time=data.get('planned_time', 10),
        actual_time=data.get('actual_time', 0),
        points=data.get('points', 1),
        repeat_setting=data.get('repeat_setting', '无'),
        start_date=data.get('start_date'),
        end_date=data.get('end_date'),
        status=data.get('status', '未完成'),
        series_id=data.get('series_id') or str(random.randint(100000, 999999))
    )
    
    db.session.add(task)
    db.session.commit()
    
    # 记录操作日志
    log = OperationLog(
        user_id=user_id,
        operation_type='添加任务',
        operation_content=f'添加任务：{task.name}',
        operation_time=datetime.now(),
        operation_result='成功'
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'success': True, 'task_id': task.id})

# 导入并注册API路由
from api import register_routes
register_routes(app)

if __name__ == '__main__':
    app.run(debug=True, port=5000)