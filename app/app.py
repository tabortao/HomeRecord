from flask import Flask, request, jsonify, send_from_directory, send_file
from werkzeug.exceptions import NotFound
from flask_cors import CORS
from models import db, User, Task, TaskCategory, Wish, OperationLog, Honor, UserHonor
from datetime import datetime, timedelta
import json
import os
import random
import uuid
from werkzeug.utils import secure_filename

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'),
    static_url_path='/static'
)
print('STATIC FOLDER ->', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'))
# 使用环境变量配置SECRET_KEY，如果没有设置则使用默认值
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key-for-development-only')
# 使用绝对路径配置数据库URI，确保在Docker环境中也能正确访问
instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
if not os.path.exists(instance_path):
    os.makedirs(instance_path, exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "homerecord.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 设置上传文件夹（使用绝对路径，指向backend/static/uploads）
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')

# 确保上传目录存在
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 确保任务图片上传目录存在
TASK_IMAGES_FOLDER = os.path.join(app.config['UPLOAD_FOLDER'], 'task_images')
if not os.path.exists(TASK_IMAGES_FOLDER):
    os.makedirs(TASK_IMAGES_FOLDER, exist_ok=True)

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'heif', 'heic'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 配置CORS，允许所有来源访问所有路由，特别是静态资源路由
CORS(app, resources={
    r"/api/*": {"origins": "*"},
    r"/uploads/*": {"origins": "*"}
})

# 静态文件服务路由
@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    # 安全地拼接文件路径
    safe_filename = os.path.normpath(filename)
    # 确保路径不会跳出uploads目录（安全检查）
    if '..' in safe_filename.split(os.sep):
        return jsonify({'success': False, 'message': '访问被拒绝'}), 403
    
    try:
        # 额外打印实际文件路径用于调试
        uploads_root = os.path.abspath(app.config['UPLOAD_FOLDER'])
        full_path = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], safe_filename))
        print('SERVE UPLOAD ->', full_path, 'exists=', os.path.exists(full_path))
        # 再次校验路径必须在 uploads 根目录下
        if not full_path.startswith(uploads_root + os.sep) and full_path != uploads_root:
            return jsonify({'success': False, 'message': '访问被拒绝'}), 403
        # 如果文件存在则直接返回文件
        if os.path.isfile(full_path):
            return send_file(full_path)
        # 回退到 send_from_directory（保持目录内类型推断）
        return send_from_directory(app.config['UPLOAD_FOLDER'], safe_filename)
    except FileNotFoundError:
        return jsonify({'success': False, 'message': '文件不存在'}), 404
    except NotFound:
        # Flask/werkzeug 在找不到文件时会抛出 NotFound，而不是 FileNotFoundError
        return jsonify({'success': False, 'message': '文件不存在'}), 404
    except Exception as e:
        print(f"提供静态文件时出错: {str(e)}")
        return jsonify({'success': False, 'message': '服务器错误'}), 500

# 首页与JS静态路由
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(app.static_folder, 'js'), filename)

@app.route('/static/<path:filename>')
def serve_static_assets(filename):
    return send_from_directory(app.static_folder, filename)

# 调试路由：查看所有已注册的URL映射
@app.route('/__routes')
def list_routes():
    try:
        rules = []
        for rule in app.url_map.iter_rules():
            rules.append({
                'endpoint': rule.endpoint,
                'methods': sorted(list(rule.methods)),
                'rule': str(rule)
            })
        return jsonify({'success': True, 'routes': rules})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# 调试：打印所有请求路径，确保路由匹配逻辑可观察
@app.before_request
def log_request_path():
    try:
        print('REQUEST PATH ->', request.path)
    except Exception:
        pass
db.init_app(app)

# 初始化数据库
with app.app_context():
    db.create_all()
    
    # 初始化内置任务分类
    # 使用try-except块确保事务安全
    try:
        # 定义新的内置学科列表
        new_categories = [
            {'name': '语文', 'color': '#FF6B6B', 'is_builtin': True},
            {'name': '数学', 'color': '#4ECDC4', 'is_builtin': True},
            {'name': '英语', 'color': '#45B7D1', 'is_builtin': True},
            {'name': '科学', 'color': '#96CEB4', 'is_builtin': True},
            {'name': '体育', 'color': '#FFEAA7', 'is_builtin': True},
            {'name': '其他', 'color': '#DDA0DD', 'is_builtin': True}
        ]
        
        # 为每个新的内置学科，先删除数据库中所有同名的记录（无论是否内置）
        for cat_data in new_categories:
            # 删除所有同名记录
            TaskCategory.query.filter_by(name=cat_data['name']).delete()
            # 立即提交删除操作
            db.session.commit()
            # 添加新的内置学科
            new_category = TaskCategory(**cat_data)
            db.session.add(new_category)
            # 立即提交添加操作
            db.session.commit()
        
        # 删除不再使用的旧内置学科
        builtin_names = set(cat['name'] for cat in new_categories)
        old_builtin = TaskCategory.query.filter(TaskCategory.is_builtin == True, ~TaskCategory.name.in_(builtin_names)).all()
        for category in old_builtin:
            db.session.delete(category)
        db.session.commit()
    except Exception as e:
        print(f"初始化内置学科时出错: {e}")
        db.session.rollback()
    
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
        {'name': '专注达人', 'description': '单次学习时长超过1小时', 'condition': '单次学习时长>60分钟', 'icon': '专注达人.png'},
        {'name': '任务高手', 'description': '单日完成任务数量超过15个', 'condition': '单日完成任务数>15', 'icon': '任务高手.png'},
        {'name': '全能选手', 'description': '单日完成所有学科任务', 'condition': '单日完成所有学科任务', 'icon': '全能选手.png'},
        {'name': '勤奋努力', 'description': '连续30天有打卡记录', 'condition': '连续30天有打卡', 'icon': '勤奋努力.png'},
        {'name': '周末战士', 'description': '周末连续完成任务', 'condition': '周末连续完成任务', 'icon': '周末战士.png'},
        {'name': '坚持到底', 'description': '连续完成同一任务30天', 'condition': '连续完成同一任务30天', 'icon': '坚持到底.png'},
        {'name': '学科之星', 'description': '单科任务完成率100%', 'condition': '单科任务完成率100%', 'icon': '学科之星.png'},
        {'name': '完美主义', 'description': '连续5天任务完成率100%', 'condition': '连续5天任务完成率100%', 'icon': '完美主义.png'},
        {'name': '心愿达人', 'description': '累计完成心愿10个', 'condition': '累计完成心愿10个', 'icon': '心愿达人.png'},
        {'name': '成长先锋', 'description': '累计获得10种不同的荣誉', 'condition': '获得10种不同荣誉', 'icon': '成长先锋.png'},
        {'name': '持之以恒', 'description': '连续打卡30天', 'condition': '连续打卡30天', 'icon': '持之以恒.png'},
        {'name': '时间管理', 'description': '提前完成任务规划', 'condition': '提前完成任务规划', 'icon': '时间管理.png'},
        {'name': '积分富翁', 'description': '累计获得积分超过1000分', 'condition': '累计获得积分>1000', 'icon': '积分富翁.png'},
        {'name': '计划大师', 'description': '单日规划任务超过20个', 'condition': '单日规划任务>20个', 'icon': '计划大师.png'},
        {'name': '进步神速', 'description': '任务完成率提升20%', 'condition': '任务完成率提升20%', 'icon': '进步神速.png'},
        {'name': '高效学习', 'description': '学习效率提升30%', 'condition': '学习效率提升30%', 'icon': '高效学习.png'},
        {'name': '学习达人', 'description': '单日学习时长超过3小时', 'condition': '单日学习时长>180分钟', 'icon': '学习达人.png'},
        {'name': '连续打卡7天', 'description': '连续7天完成学习任务', 'condition': '连续7天完成学习任务', 'icon': '连续打卡7天.png'},
        {'name': '阅读之星', 'description': '累计阅读时长超过10小时', 'condition': '累计阅读时长>600分钟', 'icon': '阅读之星.png'},
        {'name': '早起鸟', 'description': '连续7天在早上6点前打卡', 'condition': '连续7天早上6点前打卡', 'icon': '早起鸟.png'}
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
    if user and user.check_password(password):
        # 获取用户权限信息
        permissions = None
        if user.permissions:
            try:
                permissions = json.loads(user.permissions)
            except:
                permissions = {'view_only': True}  # 默认仅查看权限
        
        return jsonify({'success': True, 'user': {
            'id': user.id,
            'username': user.username,
            'nickname': user.nickname or user.username,
            'phone': user.phone,
            'avatar': user.avatar,
            'role': user.role,
            'parent_id': user.parent_id,  # 添加父账号ID
            'permissions': permissions,    # 添加权限信息
            'total_gold': user.total_gold
        }})
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
    
    new_user = User(username=username, role=role, total_gold=0, total_tomato=0)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'success': True, 'user': {'id': new_user.id, 'username': new_user.username, 'role': new_user.role}})

# 任务相关路由
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    # 获取请求中的用户ID
    current_user_id = request.args.get('user_id')
    date = request.args.get('date')
    category = request.args.get('category')
    
    if not current_user_id:
        return jsonify({'success': False, 'message': '缺少用户ID参数'}), 400
    
    # 查询当前用户信息，判断是否为子账号
    current_user = User.query.get(current_user_id)
    if not current_user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    # 确定要查询的用户ID - 子账号应该只看到父账号的任务
    query_user_id = current_user_id
    if current_user.parent_id is not None:
        query_user_id = current_user.parent_id
    
    # 构建查询，获取指定用户的任务
    query = Task.query.filter_by(user_id=query_user_id)
    
    if date:
        query = query.filter_by(start_date=date)
    if category and category != '全部学科':
        query = query.filter_by(category=category)
    
    # 添加明确的排序逻辑，确保任务顺序一致
    # 首先按状态排序（未完成的在前），然后按创建时间排序（最新创建的在前）
    query = query.order_by(
        Task.status != '未完成',  # 未完成的任务排在前面
        Task.id.desc()  # 按ID降序（假设ID自增，表示创建时间顺序）
    )
    
    tasks = query.all()
    result = []
    for task in tasks:
        # 解析images字段，返回空列表如果为None或解析失败
        images = []
        if task.images:
            try:
                images = json.loads(task.images)
            except json.JSONDecodeError:
                images = []
        
        # 解析用户权限
        permissions = {}
        if current_user.permissions:
            try:
                parsed = json.loads(current_user.permissions)
                # 确保permissions是字典类型
                if isinstance(parsed, dict):
                    permissions = parsed
            except (json.JSONDecodeError, TypeError):
                permissions = {}
        
        # 判断任务是否可以编辑（基于任务归属和用户权限）
        can_edit = True
        # 如果是子账号且任务属于父账号，需要检查权限
        if current_user.parent_id is not None and task.user_id == current_user.parent_id:
            # 如果是仅查看权限，则不能编辑父账号的任务
            can_edit = permissions.get('view_only') is False
        
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
            'series_id': task.series_id,
            'images': images,
            'user_id': task.user_id,  # 添加任务归属用户ID
            'can_edit': can_edit      # 添加编辑权限标志
        })
    
    return jsonify(result)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    user_id = data.get('user_id')
    
    # 处理images字段，确保它是JSON字符串格式
    images = data.get('images', [])
    images_json = json.dumps(images) if images else None
    
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
        series_id=data.get('series_id') or str(random.randint(100000, 999999)),
        images=images_json
    )
    
    # 处理重复任务创建
    repeat_setting = data.get('repeat_setting', '无')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    # 只有在设置了结束日期的情况下才创建重复任务
    if end_date and start_date and repeat_setting != '无':
        try:
            # 转换字符串日期为datetime对象
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            # 分割多选的重复设置
            repeat_settings = repeat_setting.split(',')
            
            # 星期映射表
            weekday_map = {
                '每周一': 0,
                '每周二': 1,
                '每周三': 2,
                '每周四': 3,
                '每周五': 4,
                '每周六': 5,
                '每周日': 6
            }
            
            # 处理每个重复设置
            for setting in repeat_settings:
                setting = setting.strip()  # 去除空白字符
                
                # 根据不同的重复类型创建任务
                if setting == '每天':
                    # 为每一天创建任务
                    current_date = start
                    while current_date <= end:
                        # 跳过已经创建的第一个任务
                        if current_date.strftime('%Y-%m-%d') != start_date:
                            daily_task = Task(
                                user_id=user_id,
                                name=data.get('name'),
                                description=data.get('description'),
                                icon=data.get('icon') or 'default.png',
                                category=data.get('category'),
                                planned_time=data.get('planned_time', 10),
                                actual_time=0,
                                points=data.get('points', 1),
                                repeat_setting=repeat_setting,  # 保存完整的重复设置
                                start_date=current_date.strftime('%Y-%m-%d'),
                                end_date=end_date,
                                status='未完成',
                                series_id=task.series_id,
                                images=images_json
                            )
                            db.session.add(daily_task)
                        # 前进到下一天
                        current_date += timedelta(days=1)
                
                elif setting == '每个工作日':
                    # 为每个工作日创建任务
                    current_date = start
                    while current_date <= end:
                        # 0-4代表周一至周五
                        if current_date.weekday() < 5:
                            # 跳过已经创建的第一个任务
                            if current_date.strftime('%Y-%m-%d') != start_date:
                                weekday_task = Task(
                                    user_id=user_id,
                                    name=data.get('name'),
                                    description=data.get('description'),
                                    icon=data.get('icon') or 'default.png',
                                    category=data.get('category'),
                                    planned_time=data.get('planned_time', 10),
                                    actual_time=0,
                                    points=data.get('points', 1),
                                    repeat_setting=repeat_setting,  # 保存完整的重复设置
                                    start_date=current_date.strftime('%Y-%m-%d'),
                                    end_date=end_date,
                                    status='未完成',
                                    series_id=task.series_id,
                                    images=images_json
                                )
                                db.session.add(weekday_task)
                        # 前进到下一天
                        current_date += timedelta(days=1)
                
                elif setting.startswith('每周'):
                    # 提取星期几
                    target_weekday = weekday_map.get(setting)
                    if target_weekday is not None:
                        # 为每个指定的星期几创建任务
                        current_date = start  # datetime对象是不可变的，直接赋值即可
                        
                        # 找到第一个目标星期几
                        days_ahead = target_weekday - current_date.weekday()
                        if days_ahead <= 0:  # 如果当天或已过去
                            days_ahead += 7
                        current_date += timedelta(days=days_ahead)
                        
                        # 创建所有符合条件的日期的任务
                        while current_date <= end:
                            weekly_task = Task(
                                user_id=user_id,
                                name=data.get('name'),
                                description=data.get('description'),
                                icon=data.get('icon') or 'default.png',
                                category=data.get('category'),
                                planned_time=data.get('planned_time', 10),
                                actual_time=0,
                                points=data.get('points', 1),
                                repeat_setting=repeat_setting,  # 保存完整的重复设置
                                start_date=current_date.strftime('%Y-%m-%d'),
                                end_date=end_date,
                                status='未完成',
                                series_id=task.series_id,
                                images=images_json
                            )
                            db.session.add(weekly_task)
                            
                            # 前进到下一周的同一天
                            current_date += timedelta(days=7)
        except ValueError:
            # 日期格式不正确时忽略重复创建
            pass
    
    # 添加任务到会话
    db.session.add(task)
    
    # 获取用户信息以设置昵称
    user = User.query.get(user_id)
    
    # 记录操作日志
    log = OperationLog(
        user_id=user_id,
        user_nickname=user.nickname or user.username if user else '未知用户',  # 使用用户昵称，优先昵称，其次用户名
        operation_type='添加任务',
        operation_content=f'添加任务：{task.name}',
        operation_time=datetime.now(),
        operation_result='成功'
    )
    db.session.add(log)
    
    # 合并为一次提交，确保任务和日志在同一个事务中完成
    db.session.commit()
    
    return jsonify({'success': True, 'task_id': task.id})

# 任务图片上传和获取API已移至api.py文件中

# 导入并注册API路由
from api import register_routes
register_routes(app)

# 启动时打印URL映射，辅助调试
try:
    print('=== URL MAP START ===')
    for rule in app.url_map.iter_rules():
        print(f"{rule} -> endpoint={rule.endpoint}, methods={','.join(sorted(list(rule.methods)))}")
    print('=== URL MAP END ===')
except Exception as e:
    print('打印URL映射失败:', e)

if __name__ == '__main__':
    app.run(debug=False, port=5050)