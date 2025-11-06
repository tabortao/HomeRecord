from flask import request, jsonify, send_from_directory
from models import db, User, Task, TaskCategory, Wish, OperationLog, Honor, UserHonor
from datetime import datetime, timedelta
import json
import random
import os
import uuid
import re
import time
from werkzeug.utils import secure_filename

def register_routes(app):
    # 批量添加任务API
    @app.route('/api/tasks/batch', methods=['POST'])
    def add_tasks_batch():
        print('=' * 50)
        print('收到批量添加任务请求')
        # 打印所有请求头
        print('请求头信息:')
        for key, value in request.headers:
            print(f'  {key}: {value}')
        
        # 尝试获取JSON数据
        try:
            data = request.json
            print('请求数据:', data)
            
            tasks_data = data.get('tasks', []) if data else []
            user_id = data.get('user_id') if data else None
            
            print('任务数据数量:', len(tasks_data))
            print('用户ID:', user_id)
        except Exception as e:
            print('解析请求数据失败:', str(e))
            print('请求内容类型:', request.content_type)
            print('请求原始数据:', request.get_data())
            return jsonify({'error': '请求数据格式错误'}), 400
        
        if not tasks_data:
            print('错误: 没有提供任务数据')
            return jsonify({'error': '没有提供任务数据'}), 400
        
        try:
            # 获取用户信息以设置昵称
            user = User.query.get(user_id)
            user_nickname = user.nickname or user.username if user else '未知用户'
            
            # 批量创建任务
            created_tasks = []
            for task_data in tasks_data:
                try:
                    print(f'处理任务: {task_data.get("name")}')
                    # 处理images字段，确保它是JSON字符串格式
                    images = task_data.get('images', [])
                    images_json = json.dumps(images) if images else None
                    
                    # 创建任务 - 只使用Task模型中定义的字段
                    task = Task(
                        user_id=user_id,
                        name=task_data.get('name', '未命名任务'),
                        description=task_data.get('description', ''),
                        icon=task_data.get('icon', 'default.png'),
                        category=task_data.get('category', '其他'),
                        planned_time=task_data.get('planned_time', 10),
                        actual_time=task_data.get('actual_time', 0),
                        points=task_data.get('points', 1),
                        repeat_setting=task_data.get('repeat_setting', '无'),
                        start_date=task_data.get('start_date'),
                        end_date=task_data.get('end_date'),
                        status=task_data.get('status', '未完成'),
                        series_id=task_data.get('series_id') or str(random.randint(100000, 999999)),
                        images=images_json
                    )
                    
                    # 添加任务到会话
                    db.session.add(task)
                    
                    # 立即提交以获取任务ID
                    db.session.flush()
                    
                    print(f'任务添加到会话，ID: {task.id}')
                    
                    # 处理重复任务创建
                    repeat_setting = task_data.get('repeat_setting', '无')
                    start_date = task_data.get('start_date')
                    end_date = task_data.get('end_date')
                    
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
                                                name=task_data.get('name', '未命名任务'),
                                                description=task_data.get('description', ''),
                                                icon=task_data.get('icon', 'default.png'),
                                                category=task_data.get('category', '其他'),
                                                planned_time=task_data.get('planned_time', 10),
                                                actual_time=0,
                                                points=task_data.get('points', 1),
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
                                                    name=task_data.get('name', '未命名任务'),
                                                    description=task_data.get('description', ''),
                                                    icon=task_data.get('icon', 'default.png'),
                                                    category=task_data.get('category', '其他'),
                                                    planned_time=task_data.get('planned_time', 10),
                                                    actual_time=0,
                                                    points=task_data.get('points', 1),
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
                                                name=task_data.get('name', '未命名任务'),
                                                description=task_data.get('description', ''),
                                                icon=task_data.get('icon', 'default.png'),
                                                category=task_data.get('category', '其他'),
                                                planned_time=task_data.get('planned_time', 10),
                                                actual_time=0,
                                                points=task_data.get('points', 1),
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
                    
                    # 将任务ID添加到创建列表
                    created_tasks.append(task.id)
                except Exception as e:
                    print(f'处理任务时出错: {str(e)}')
                    # 继续处理下一个任务
                    continue
            
            # 记录操作日志
            log = OperationLog(
                user_id=user_id,
                user_nickname=user_nickname,
                operation_type='批量添加任务',
                operation_content=f'批量添加任务，共{len(created_tasks)}个',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            
            # 合并为一次提交，确保所有任务和日志在同一个事务中完成
            db.session.commit()
            
            print('任务创建成功，创建的任务ID列表:', created_tasks)
            print('返回响应: 成功创建', len(created_tasks), '个任务')
            return jsonify({'success': True, 'created_task_ids': created_tasks, 'count': len(created_tasks)})
            
        except Exception as e:
            db.session.rollback()
            print('任务创建失败:', str(e))
            return jsonify({'error': '批量添加任务失败', 'details': str(e)}), 500
    
    # 确保头像上传根目录存在 - 修改为backend/static/uploads/avatars
    AVATAR_ROOT_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'avatars')
    if not os.path.exists(AVATAR_ROOT_FOLDER):
        os.makedirs(AVATAR_ROOT_FOLDER, exist_ok=True)
    
    # 允许的文件扩展名
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
    
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    
    # 获取用户信息路由
    @app.route('/api/users/<int:user_id>', methods=['GET'])
    def get_user_info(user_id):
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 获取父账号信息（如果有）
        parent_info = None
        if user.parent_id:
            parent = User.query.get(user.parent_id)
            if parent:
                parent_info = {
                    'id': parent.id,
                    'username': parent.username,
                    'nickname': parent.nickname or parent.username
                }
        
        # 获取权限信息
        permissions = None
        if user.permissions:
            try:
                permissions = json.loads(user.permissions)
            except:
                permissions = {'view_only': True}  # 默认仅查看权限
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'nickname': user.nickname or user.username,
                'phone': user.phone,
                'avatar': user.avatar,
                'role': user.role,
                'parent_id': user.parent_id,  # 是否是子账号
                'parent_info': parent_info,    # 父账号信息
                'permissions': permissions,    # 权限信息
                'total_gold': user.total_gold
            }
        })
    
    # 更新用户信息路由
    @app.route('/api/users/<int:user_id>', methods=['PUT'])
    def update_user_info(user_id):
        data = request.json
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 更新用户信息
        if 'username' in data:
            user.username = data['username']
        if 'nickname' in data:
            user.nickname = data['nickname']
        if 'phone' in data:
            user.phone = data['phone']
        if 'avatar' in data:
            user.avatar = data['avatar']
        # 更新权限信息 - 添加对子账号权限的处理
        if 'permissions' in data:
            # 根据前端传入的值设置权限对象
            if data['permissions'] == 'edit':
                user.permissions = json.dumps({'view_only': False})
            else:  # view或其他值默认为仅查看
                user.permissions = json.dumps({'view_only': True})
        elif 'permission' in data:  # 兼容另一种字段名
            if data['permission'] == 'edit':
                user.permissions = json.dumps({'view_only': False})
            else:  # view或其他值默认为仅查看
                user.permissions = json.dumps({'view_only': True})
        
        # 处理密码更新
        if 'current_password' in data and 'new_password' in data:
            # 这里需要实现密码验证逻辑
            # 假设User模型有check_password方法
            if hasattr(user, 'check_password'):
                if not user.check_password(data['current_password']):
                    return jsonify({'success': False, 'message': '当前密码错误'})
            user.password = data['new_password']
        
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=user_id,
            user_nickname=user.nickname or user.username,  # 使用昵称，如果没有则使用用户名
            operation_type='更新个人信息',
            operation_content='更新用户个人信息',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '个人信息更新成功'})
    
    # 更新用户金币数量路由
    @app.route('/api/users/<int:user_id>/gold', methods=['PUT'])
    def update_user_gold(user_id):
        data = request.json
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 验证输入数据
        if 'gold' not in data or 'reason' not in data:
            return jsonify({'success': False, 'message': '缺少必要参数'})
        
        try:
            new_gold = int(data['gold'])
            if new_gold < 0:
                return jsonify({'success': False, 'message': '金币数量不能为负数'})
        except ValueError:
            return jsonify({'success': False, 'message': '金币数量必须是整数'})
        
        reason = data['reason'].strip()
        if len(reason) < 2:
            return jsonify({'success': False, 'message': '修改原因至少需要2个字符'})
        
        # 保存旧的金币数量用于日志
        old_gold = user.total_gold
        
        # 更新金币数量
        user.total_gold = new_gold
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=user_id,
            user_nickname=user.nickname or user.username,  # 使用昵称，如果没有则使用用户名
            operation_type='更新金币数量',
            operation_content=f'金币从{old_gold}修改为{new_gold}，原因：{reason}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '金币数量更新成功'})
    
    # 上传头像路由
    @app.route('/api/users/<int:user_id>/avatar', methods=['POST'])
    def upload_avatar(user_id):
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '没有选择文件'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '没有选择文件'})
        
        if file and allowed_file(file.filename):
            # 确保头像根目录存在
            if not os.path.exists(AVATAR_ROOT_FOLDER):
                os.makedirs(AVATAR_ROOT_FOLDER, exist_ok=True)
            
            # 生成唯一文件名，格式为：用户ID-avatars-图像名
            ext = file.filename.rsplit('.', 1)[1].lower()
            unique_id = uuid.uuid4()
            filename = f"{user_id}-avatars-{unique_id}.{ext}"
            file_path = os.path.join(AVATAR_ROOT_FOLDER, filename)
            
            # 保存文件
            file.save(file_path)
            
            # 更新用户头像信息，直接存储文件名
            user.avatar = filename
            db.session.commit()
            
            # 记录操作日志
            log = OperationLog(
                user_id=user_id,
                user_nickname=user.nickname or user.username,  # 使用昵称，如果没有则使用用户名
                operation_type='上传头像',
                operation_content=f'上传新头像：{filename}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            db.session.commit()
            
            return jsonify({'success': True, 'filename': filename, 'message': '头像上传成功'})
        
        return jsonify({'success': False, 'message': '不支持的文件类型'})
    
    # 获取头像路由 - 支持直接文件名格式
    @app.route('/api/avatars/<path:avatar_path>', methods=['GET'])
    def get_avatar(avatar_path):
        # 验证路径安全性，防止路径遍历攻击
        if '..' in avatar_path or '\\' in avatar_path:
            return jsonify({'success': False, 'message': '无效的文件路径'}), 400
        
        # 确保文件存在（直接在AVATAR_ROOT_FOLDER中查找）
        full_path = os.path.join(AVATAR_ROOT_FOLDER, avatar_path)
        if not os.path.exists(full_path):
            # 尝试检查是否是旧的路径格式（包含子目录）
            legacy_path = os.path.join(AVATAR_ROOT_FOLDER, avatar_path)
            if not os.path.exists(legacy_path):
                return jsonify({'success': False, 'message': '文件不存在'}), 404
            full_path = legacy_path
        
        # 直接从根目录发送文件
        return send_from_directory(AVATAR_ROOT_FOLDER, avatar_path)
    
    # 任务相关路由
    # 获取任务列表
    @app.route('/api/tasks/unfinished', methods=['GET'])
    def get_unfinished_tasks():
        try:
            # 获取当前用户ID
            user_id = request.args.get('user_id', type=int)
            
            if not user_id:
                return jsonify({'error': '缺少用户ID参数'}), 400
            
            # 获取用户信息，检查是否为子账号
            user = User.query.get(user_id)
            # 如果是子账号，使用父账号ID来查询数据
            effective_user_id = user.parent_id if user and user.parent_id else user_id
            
            app.logger.info(f"获取未完成任务，用户ID: {user_id}, 有效用户ID: {effective_user_id}")
            
            # 构建查询，获取所有未完成的任务
            query = Task.query.filter_by(user_id=effective_user_id, status='未完成')
            
            # 按日期升序排序，先获取较早的任务
            query = query.order_by(Task.start_date.asc())
            
            # 执行查询
            tasks = query.all()
            
            # 转换为字典列表
            result = []
            for task in tasks:
                # 解析images字段
                images = []
                if task.images:
                    try:
                        images = json.loads(task.images)
                    except json.JSONDecodeError:
                        images = []
                
                task_dict = {
                    'id': task.id,
                    'name': task.name,
                    'category': task.category,
                    'points': task.points,
                    'status': task.status,
                    'start_date': task.start_date,
                    'end_date': task.end_date,
                    'planned_time': task.planned_time,
                    'actual_time': task.actual_time,
                    'description': task.description,
                    'user_id': task.user_id,
                    'series_id': task.series_id,
                    'images': images,
                    'created_at': task.created_at.isoformat() if task.created_at else None
                }
                result.append(task_dict)
            
            app.logger.info(f"找到 {len(result)} 个未完成任务")
            return jsonify(result)
        except Exception as e:
            app.logger.error(f"获取未完成任务失败: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/tasks', methods=['GET'])
    def get_tasks_list():
         try:
             user_id = request.args.get('user_id', type=int)
             date = request.args.get('date')
             category = request.args.get('category')
              
             # 获取用户信息，检查是否为子账号
             user = User.query.get(user_id)
             # 如果是子账号，使用父账号ID来查询数据
             effective_user_id = user.parent_id if user and user.parent_id else user_id
             
             app.logger.info(f"Getting tasks for user_id: {user_id}, effective_user_id: {effective_user_id}, date: {date}, category: {category}")
              
             # 构建查询
             query = Task.query.filter_by(user_id=effective_user_id)
             
             # 按日期筛选
             if date:
                 query = query.filter_by(date=date)
             
             # 按分类筛选
             if category and category != '全部学科':
                 query = query.filter_by(category=category)
             
             # 执行查询
             tasks = query.all()
             
             # 转换为字典列表
             result = []
             for task in tasks:
                 task_dict = {
                     'id': task.id,
                     'name': task.name,
                     'category': task.category,
                     'points': task.points,
                     'status': task.status,
                     'date': task.date,
                     'expected_time': task.expected_time,
                     'actual_time': task.actual_time,
                     'description': task.description,
                     'user_id': task.user_id,
                     'created_at': task.created_at.isoformat() if task.created_at else None,
                     'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                     'series_id': task.series_id,
                     'images': json.loads(task.images) if task.images else []
                 }
                 result.append(task_dict)
             
             app.logger.info(f"Found {len(result)} tasks")
             # 确保始终返回有效的JSON数据
             return jsonify(result)
         except Exception as e:
             app.logger.error(f"Error getting tasks: {e}")
             # 确保错误响应也是有效的JSON
             return jsonify({'error': str(e)}), 500
    
    @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
    def update_task(task_id):
        data = request.json
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'success': False, 'message': '任务不存在'})
        
        # 检查任务状态是否从非已完成变为已完成或从未完成变为已完成
        was_completed = task.status == '已完成'
        
        # 更新任务信息
        for key, value in data.items():
            if hasattr(task, key) and key != 'id' and key != 'user_id':
                if key == 'images':
                    # 确保images是JSON字符串格式
                    setattr(task, key, json.dumps(value) if value else None)
                else:
                    setattr(task, key, value)
        
        task.updated_at = datetime.now()
        
        # 使用任务的用户ID作为操作用户
        operator_name = '系统'  # 或使用任务创建者的用户名
        # 也可以从请求参数中获取操作人信息（如果前端能传递的话）
        
        # 获取当前操作用户（如果有）
        current_user_id = request.args.get('current_user_id', type=int)
        current_user = User.query.get(current_user_id) if current_user_id else None
        current_user_nickname = current_user.nickname or current_user.username if current_user else '系统'
        
        # 获取任务所属用户
        user = User.query.get(task.user_id)
        user_nickname = user.nickname or user.username if user else '未知用户'
        
        # 记录操作日志，根据任务状态变更决定日志类型和内容
        if not was_completed and task.status == '已完成':
            # 任务从不完成变为已完成
            if user:
                # 增加金币，任务积分即为金币数量
                user.total_gold += task.points
                
            # 如果有当前操作用户且与任务所属用户不同（子账号完成主账号任务）
            if current_user and current_user.id != task.user_id:
                # 只为操作用户（子账号）创建日志：完成了用户{主账号昵称}的任务
                operator_log = OperationLog(
                    user_id=current_user.id,
                    user_nickname=current_user_nickname,
                    operation_type='任务完成',
                    operation_content=f'完成了用户{user_nickname}的任务：{task.name}，获得{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(operator_log)
            else:
                # 如果是任务所属用户自己完成任务，记录普通完成日志
                task_user_log = OperationLog(
                    user_id=task.user_id,
                    user_nickname=user_nickname,
                    operation_type='任务完成',
                    operation_content=f'完成任务：{task.name}，获得{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(task_user_log)
                
        elif was_completed and task.status == '未完成':
            # 任务从已完成变为未完成，需要撤销金币
            if user:
                # 扣除金币，不允许金币变为负数
                user.total_gold = max(0, user.total_gold - task.points)
            
            # 如果有当前操作用户且与任务所属用户不同（子账号撤销主账号任务完成）
            if current_user and current_user.id != task.user_id:
                # 只为操作用户（子账号）创建日志：撤销了用户{主账号昵称}的任务完成
                operator_log = OperationLog(
                    user_id=current_user.id,
                    user_nickname=current_user_nickname,
                    operation_type='任务撤销',
                    operation_content=f'撤销了用户{user_nickname}的任务完成：{task.name}，扣除{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(operator_log)
            else:
                # 如果是任务所属用户自己撤销任务，记录普通撤销日志
                task_user_log = OperationLog(
                    user_id=task.user_id,
                    user_nickname=user_nickname,
                    operation_type='任务撤销',
                    operation_content=f'撤销完成任务：{task.name}，扣除{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(task_user_log)
                
        else:
            # 其他状态变更，记录普通更新日志
            # 如果有当前操作用户且与任务所属用户不同（子账号更新主账号任务）
            if current_user and current_user.id != task.user_id:
                # 只为操作用户（子账号）创建日志：更新了用户{主账号昵称}的任务
                operator_log = OperationLog(
                    user_id=current_user.id,
                    user_nickname=current_user_nickname,
                    operation_type='更新任务',
                    operation_content=f'更新了用户{user_nickname}的任务：{task.name}，状态变更为{data.get("status")}',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(operator_log)
            else:
                # 如果是任务所属用户自己更新任务，记录普通更新日志
                task_user_log = OperationLog(
                    user_id=task.user_id,
                    user_nickname=user_nickname,
                    operation_type='更新任务',
                    operation_content=f'更新任务：{task.name}，状态变更为{data.get("status")}',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(task_user_log)
        
        # 确保只提交一次，这样任务状态更新和金币变更会在同一个事务中完成
        db.session.commit()
        
        return jsonify({'success': True})
    
    @app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
    def delete_task(task_id):
        try:
            app.logger.info(f"开始删除任务，task_id: {task_id}")
            task = Task.query.get(task_id)
            if not task:
                app.logger.warning(f"任务不存在，task_id: {task_id}")
                return jsonify({'success': False, 'message': '任务不存在'})
            
            user_id = task.user_id
            task_name = task.name
            task_points = task.points
            task_status = task.status
            
            app.logger.info(f"获取任务信息成功，user_id: {user_id}, task_name: {task_name}, task_status: {task_status}")
            
            # 初始化操作者名称，避免未定义的情况
            operator_name = '系统'
            
            # 删除任务相关的图片文件
            if task.images:
                try:
                    # 使用后端配置的上传目录（backend/static/uploads）
                    upload_folder = app.config['UPLOAD_FOLDER']
                    
                    # 解析图片URL列表
                    image_urls = json.loads(task.images)
                    app.logger.info(f"开始处理任务{task_id}的{len(image_urls)}张图片")
                    
                    # 方法1：直接删除任务ID对应的目录（更高效的方式）
                    task_dir = os.path.join(upload_folder, 'task_images', str(user_id), str(task_id))
                    if os.path.exists(task_dir):
                        app.logger.info(f"找到任务{task_id}的图片目录: {task_dir}")
                        # 递归删除目录及其所有内容
                        import shutil
                        try:
                            shutil.rmtree(task_dir)
                            app.logger.info(f"成功删除任务目录及其所有内容: {task_dir}")
                        except Exception as e:
                            app.logger.error(f"删除任务目录时出错 {task_dir}: {str(e)}")
                    else:
                        app.logger.info(f"任务目录不存在: {task_dir}")
                    
                    # 方法2：直接从URL构建绝对路径并删除（作为备用方法）
                    for image_url in image_urls:
                        try:
                            # 构建正确的文件路径
                            if image_url.startswith('/static/uploads/'):
                                # 从/static/uploads/开头的URL中提取相对路径
                                relative_path = image_url.replace('/static/uploads/', '')
                                file_path = os.path.join(upload_folder, relative_path)
                            elif image_url.startswith('static/uploads/'):
                                # 处理没有前导斜杠的情况
                                file_path = os.path.join(upload_folder, image_url.replace('static/uploads/', ''))
                            else:
                                # 尝试从URL中提取task_images部分
                                if '/task_images/' in image_url:
                                    path_parts = image_url.split('/task_images/')[1]
                                    file_path = os.path.join(upload_folder, 'task_images', path_parts)
                                else:
                                    # 无法解析的URL格式
                                    continue
                            
                            # 尝试删除文件
                            if os.path.exists(file_path):
                                os.remove(file_path)
                                app.logger.info(f"通过URL解析删除成功: {file_path}")
                        except Exception as e:
                            app.logger.error(f"处理URL {image_url} 时出错: {str(e)}")
                            
                except Exception as e:
                    app.logger.error(f"删除图片时出错: {str(e)}")
                    # 继续执行任务删除，不因图片删除失败而中断
            
            # 如果是已完成的任务，需要扣除对应的金币
            if task_status == '已完成' and task_points > 0:
                # 获取用户
                user = User.query.get(user_id)
                if user:
                    # 扣除金币
                    user.total_gold = max(0, user.total_gold - task_points)
                    
                    # 获取操作用户信息
                    # 注意：这里使用任务所属用户作为操作者
                    # 实际项目中应该从认证信息中获取当前登录用户
                    current_user = User.query.get(user_id)
                    if current_user:
                        operator_name = current_user.username
                    
                    # 记录金币扣除日志
                    gold_log = OperationLog(
                        user_id=user_id,
                        user_nickname=current_user.nickname or current_user.username if current_user else '系统',  # 使用昵称或用户名
                        operation_type='修改金币',
                        operation_content=f'删除已完成任务：{task_name}，扣除{task_points}金币',
                        operation_time=datetime.now(),
                        operation_result='成功'
                    )
                    db.session.add(gold_log)
            
            # 删除任务记录
            db.session.delete(task)
            
            # 记录操作日志
            log = OperationLog(
                user_id=user_id,
                user_nickname=operator_name if 'operator_name' in locals() else '系统',
                operation_type='删除任务',
                operation_content=f'删除任务：{task_name}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            
            # 合并为一次提交，确保任务删除和日志记录在同一个事务中完成
            db.session.commit()
            
            app.logger.info(f"任务删除成功，task_id: {task_id}")
            return jsonify({'success': True})
        except Exception as e:
            # 发生异常时回滚事务
            db.session.rollback()
            app.logger.error(f"删除任务时发生异常，task_id: {task_id}, 错误信息: {str(e)}")
            return jsonify({'success': False, 'message': f'删除任务失败: {str(e)}'})
    
    # 上传任务图片
    @app.route('/api/tasks/<int:task_id>/upload', methods=['POST'])
    def upload_task_images(task_id):
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'success': False, 'message': '任务不存在'})
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '没有文件上传'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '未选择文件'})
        
        # 验证文件类型
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
        if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in ALLOWED_EXTENSIONS:
            return jsonify({'success': False, 'message': '不支持的文件类型'})
        
        # 创建上传目录，按照 user_id/task_id 的结构组织
        # 使用app.config['UPLOAD_FOLDER']作为基础目录，确保指向frontend/static/uploads
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'task_images', str(task.user_id), str(task_id))
        os.makedirs(upload_folder, exist_ok=True)
        
        # 生成带时间戳的文件名，格式：年月日时分秒_原始文件名
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        original_filename = secure_filename(file.filename)
        filename = f"{timestamp}_{original_filename}"
        
        # 保存文件
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        # 更新任务的图片信息
        images = json.loads(task.images or '[]')
        # 使用/static/uploads/前缀，便于前端直接访问静态目录
        image_url = f'/static/uploads/task_images/{task.user_id}/{task_id}/{filename}'
        images.append(image_url)
        task.images = json.dumps(images)
        db.session.commit()
        
        # 获取当前操作用户信息
        current_user = User.query.get(task.user_id)
        
        # 记录操作日志
        log = OperationLog(
            user_id=task.user_id,
            user_nickname=current_user.nickname or current_user.username if current_user else '未知用户',  # 使用昵称或用户名
            operation_type='上传任务图片',
            operation_content=f'为任务{task.name}上传图片',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '图片上传成功', 'image_url': f'/static/uploads/task_images/{task.user_id}/{task_id}/{filename}'})
    
    # 提供上传文件的访问 - 已在app.py中定义
    # 提供头像的访问路由
    @app.route('/api/avatars/<path:filename>')
    def serve_avatar(filename):
        # 安全地拼接文件路径
        safe_filename = os.path.normpath(filename)
        # 确保路径不会跳出uploads目录（安全检查）
        if '..' in safe_filename.split(os.sep):
            return jsonify({'success': False, 'message': '访问被拒绝'}), 403
        
        try:
            return send_from_directory(AVATAR_ROOT_FOLDER, safe_filename)
        except FileNotFoundError:
            return jsonify({'success': False, 'message': '文件不存在'}), 404
        except Exception as e:
            print(f"提供头像文件时出错: {str(e)}")
            return jsonify({'success': False, 'message': '服务器错误'}), 500
    
    @app.route('/api/tasks/series/<series_id>', methods=['DELETE'])
    def delete_task_series(series_id):
        """
        删除任务系列。
        支持可选查询参数 from_date (YYYY-MM-DD)，当提供该参数时，仅删除该日期及之后的系列任务。
        未提供 from_date 时，删除整个系列的所有任务。
        """
        try:
            from_date = request.args.get('from_date')

            # 根据是否提供 from_date 选择删除范围
            if from_date:
                tasks = Task.query.filter(Task.series_id == series_id, Task.start_date >= from_date).all()
            else:
                tasks = Task.query.filter_by(series_id=series_id).all()

            if not tasks:
                return jsonify({'success': False, 'message': '任务系列不存在或没有匹配的任务'})

            user_id = tasks[0].user_id
            total_deducted_points = 0

            # 为每个任务删除对应的图片文件
            for task in tasks:
                if task.images:
                    try:
                        image_urls = json.loads(task.images)
                        upload_folder = app.config['UPLOAD_FOLDER']

                        # 删除任务ID对应目录
                        task_dir = os.path.join(upload_folder, 'task_images', str(user_id), str(task.id))
                        if os.path.exists(task_dir):
                            import shutil
                            try:
                                shutil.rmtree(task_dir)
                            except Exception as e:
                                print(f"删除任务目录时出错 {task_dir}: {str(e)}")

                        # 备用：从URL删除文件
                        for image_url in image_urls:
                            try:
                                if image_url.startswith('/static/uploads/'):
                                    relative_path = image_url.replace('/static/uploads/', '')
                                    file_path = os.path.join(upload_folder, relative_path)
                                elif image_url.startswith('static/uploads/'):
                                    file_path = os.path.join(upload_folder, image_url.replace('static/uploads/', ''))
                                else:
                                    if '/task_images/' in image_url:
                                        path_parts = image_url.split('/task_images/')[1]
                                        file_path = os.path.join(upload_folder, 'task_images', path_parts)
                                    else:
                                        continue
                                if os.path.exists(file_path):
                                    os.remove(file_path)
                            except Exception as e:
                                print(f"处理任务图片URL {image_url} 时出错: {str(e)}")
                    except Exception as e:
                        print(f"删除任务图片时出错: {str(e)}")

                # 统计金币扣除（已完成任务）
                if task.status == '已完成' and task.points > 0:
                    total_deducted_points += task.points

                # 删除任务记录
                db.session.delete(task)

            # 更新用户金币数
            if total_deducted_points > 0:
                user = User.query.get(user_id)
                if user:
                    user.total_gold = max(0, user.total_gold - total_deducted_points)

            db.session.commit()

            # 记录操作日志（健壮处理current_user可能为空的情况）
            current_user = User.query.get(user_id)
            user_nickname = (
                current_user.nickname if current_user and current_user.nickname
                else (current_user.username if current_user else '未知用户')
            )
            scope_text = '及未来任务' if from_date else '所有任务'
            log = OperationLog(
                user_id=user_id,
                user_nickname=user_nickname,
                operation_type='删除任务系列',
                operation_content=f'删除系列({series_id})的{scope_text}，from_date={from_date or "无"}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            db.session.commit()

            return jsonify({'success': True})
        except Exception as e:
            db.session.rollback()
            try:
                app.logger.error(f"删除任务系列时发生异常，series_id: {series_id}, 错误信息: {str(e)}")
            except Exception:
                print(f"删除任务系列时发生异常，series_id: {series_id}, 错误信息: {str(e)}")
            return jsonify({'success': False, 'message': f'删除任务系列失败: {str(e)}'}), 500
    
    # 任务分类相关路由
    @app.route('/api/categories', methods=['GET'])
    def get_categories():
        user_id = request.args.get('user_id')
        
        # 获取内置分类和用户自定义分类，并按sort_order升序排列
        categories = TaskCategory.query.filter(
            (TaskCategory.is_builtin == True) | (TaskCategory.user_id == user_id)
        ).order_by(TaskCategory.sort_order.asc(), TaskCategory.name.asc()).all()
        
        result = []
        for category in categories:
            result.append({
                'id': category.id,
                'name': category.name,
                'color': category.color,
                'is_builtin': category.is_builtin,
                'sort_order': category.sort_order if hasattr(category, 'sort_order') else None
            })
        
        return jsonify(result)
    
    @app.route('/api/categories', methods=['POST'])
    def add_category():
        data = request.json
        user_id = data.get('user_id')
        
        # 检查分类名称是否已存在
        if TaskCategory.query.filter_by(name=data.get('name')).first():
            return jsonify({'success': False, 'message': '分类名称已存在'})
        
        # 计算新的排序位置（追加到末尾）
        last = TaskCategory.query.order_by(TaskCategory.sort_order.desc()).first()
        next_order = (last.sort_order + 1) if last and last.sort_order is not None else 1

        category = TaskCategory(
            user_id=user_id,
            name=data.get('name'),
            color=data.get('color', '#999999'),
            is_builtin=False,
            sort_order=next_order
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({'success': True, 'category': {
            'id': category.id,
            'name': category.name,
            'color': category.color,
            'is_builtin': category.is_builtin,
            'sort_order': category.sort_order
        }})
    
    @app.route('/api/categories/<int:category_id>', methods=['PUT'])
    def update_category(category_id):
        category = TaskCategory.query.get(category_id)
        if not category:
            return jsonify({'success': False, 'message': '分类不存在'})
        
        data = request.json
        
        # 检查是否要修改名称
        if 'name' in data and data['name'] != category.name:
            # 检查新名称是否已存在
            existing_category = TaskCategory.query.filter_by(name=data['name']).first()
            if existing_category:
                return jsonify({'success': False, 'message': '分类名称已存在'})
            
            # 如果修改了名称，需要同步更新所有使用该分类的任务
            if data['name'] != category.name:
                old_name = category.name
                category.name = data['name']
                # 更新所有使用该分类的任务
                tasks = Task.query.filter_by(category=old_name).all()
                for task in tasks:
                    task.category = data['name']
        
        # 更新颜色
        if 'color' in data:
            category.color = data['color']

        # 更新排序
        if 'sort_order' in data:
            try:
                category.sort_order = int(data['sort_order'])
            except Exception:
                pass
        
        db.session.commit()
        
        return jsonify({'success': True, 'category': {
            'id': category.id,
            'name': category.name,
            'color': category.color,
            'is_builtin': category.is_builtin,
            'sort_order': category.sort_order
        }})
    
    @app.route('/api/categories/<int:category_id>', methods=['DELETE'])
    def delete_category(category_id):
        category = TaskCategory.query.get(category_id)
        if not category:
            return jsonify({'success': False, 'message': '分类不存在'})
        
        if category.is_builtin:
            return jsonify({'success': False, 'message': '内置分类不能删除'})
        
        # 检查是否有任务使用该分类
        tasks = Task.query.filter_by(category=category.name).all()
        if tasks:
            return jsonify({'success': False, 'message': '该分类下还有任务，无法删除'})
        
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({'success': True})

    # 批量更新分类排序
    @app.route('/api/categories/reorder', methods=['PUT'])
    def reorder_categories():
        try:
            data = request.json or {}
            orders = data.get('orders') or data.get('category_orders') or []
            if not isinstance(orders, list):
                return jsonify({'success': False, 'message': '请求数据格式错误'}), 400

            updated = 0
            for item in orders:
                cid = item.get('id')
                order = item.get('sort_order')
                if cid is None or order is None:
                    continue
                category = TaskCategory.query.get(cid)
                if category:
                    try:
                        category.sort_order = int(order)
                        updated += 1
                    except Exception:
                        pass
            db.session.commit()
            return jsonify({'success': True, 'updated': updated})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    
    # 心愿相关路由
    @app.route('/api/wishes/upload', methods=['POST'])
    def upload_wish_image():
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': '用户ID不能为空'})
        
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '未找到上传文件'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '未选择文件'})
        
        # 检查文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'heif', 'heic'}
        extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        # 如果没有扩展名，从MIME类型推断
        if not extension:
            mime_type = file.content_type
            if mime_type == 'image/png':
                extension = 'png'
            elif mime_type in ['image/jpeg', 'image/jpg']:
                extension = 'jpg'
            elif mime_type == 'image/gif':
                extension = 'gif'
            elif mime_type in ['image/heif', 'image/heic']:
                extension = 'heic'
            else:
                return jsonify({'success': False, 'message': '不支持的文件类型'})
        
        if extension not in allowed_extensions:
            return jsonify({'success': False, 'message': '不支持的文件类型，请上传PNG、JPG、GIF或HEIF格式的图片'})
        
        try:
            # 创建上传目录（使用绝对路径）
            user_wish_dir = os.path.join('wish', str(user_id))
            upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], user_wish_dir)
            
            # 确保目录存在
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir, exist_ok=True)
            
            # 生成唯一文件名
            filename = f'wish_{user_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}.{extension}'
            filepath = os.path.join(upload_dir, filename)
            
            # 保存文件
            file.save(filepath)
            
            # 验证文件是否成功保存
            if not os.path.exists(filepath):
                return jsonify({'success': False, 'message': '图片保存失败，文件未写入磁盘'})
            
            # 生成图片URL，使用/static/uploads/开头，便于前端直接访问
            image_url = f'/static/uploads/wish/{user_id}/{filename}'
            
            print(f"图片上传成功: {filepath}")
            return jsonify({'success': True, 'image_url': image_url, 'message': '图片上传成功'})
        except Exception as e:
            print(f"图片上传异常: {str(e)}")
            return jsonify({'success': False, 'message': f'图片保存失败：{str(e)}'})
    
    @app.route('/api/wishes', methods=['GET'])
    def get_wishes():
        user_id = request.args.get('user_id')
        
        # 获取用户信息，检查是否为子账号
        user = User.query.get(user_id)
        # 如果是子账号，使用父账号ID来查询数据
        effective_user_id = user.parent_id if user and user.parent_id else user_id
        
        # 获取内置心愿和主账号/子账号相关心愿
        wishes = Wish.query.filter(
            (Wish.is_builtin == True) | (Wish.user_id == effective_user_id)
        ).all()
        
        result = []
        for wish in wishes:
            result.append({
                'id': wish.id,
                'name': wish.name,
                'content': wish.content,
                'icon': wish.icon,
                'cost': wish.cost,
                'unit': wish.unit,
                'exchange_count': wish.exchange_count,
                'exchange_amount': wish.exchange_amount,
                'is_builtin': wish.is_builtin
            })
        
        return jsonify(result)
    
    @app.route('/api/wishes', methods=['POST'])
    def add_wish():
        data = request.json
        user_id = data.get('user_id')
        
        wish = Wish(
            user_id=user_id,
            name=data.get('name'),
            content=data.get('content'),
            icon=data.get('icon'),
            cost=data.get('cost'),
            unit=data.get('unit'),
            exchange_amount=data.get('exchange_amount', 1),
            exchange_count=0,
            is_builtin=False
        )
        
        db.session.add(wish)
        db.session.commit()
        
        return jsonify({'success': True, 'wish': {
            'id': wish.id,
            'name': wish.name,
            'content': wish.content,
            'icon': wish.icon,
            'cost': wish.cost,
            'unit': wish.unit,
            'exchange_amount': wish.exchange_amount,
            'exchange_count': wish.exchange_count,
            'is_builtin': wish.is_builtin
        }})
    
    @app.route('/api/wishes/<int:wish_id>', methods=['PUT'])
    def update_wish(wish_id):
        data = request.json
        wish = Wish.query.get(wish_id)
        if not wish:
            return jsonify({'success': False, 'message': '心愿不存在'})
        
        # 允许编辑内置心愿，但不允许修改is_builtin属性
        # 更新心愿信息
        for key, value in data.items():
            if hasattr(wish, key) and key != 'id' and key != 'user_id' and key != 'is_builtin':
                setattr(wish, key, value)
        
        db.session.commit()
        
        return jsonify({'success': True})
    
    @app.route('/api/wishes/<int:wish_id>', methods=['DELETE'])
    def delete_wish(wish_id):
        wish = Wish.query.get(wish_id)
        if not wish:
            return jsonify({'success': False, 'message': '心愿不存在'})
        
        if wish.is_builtin:
            return jsonify({'success': False, 'message': '内置心愿不能删除'})
        
        # 删除相关的图片文件
        if wish.icon:
            # 提取文件路径（确保安全处理）
            try:
                # 从不同格式的路径中提取实际文件路径
                if wish.icon.startswith('/uploads/'):
                    image_path = wish.icon[len('/uploads/'):]
                elif wish.icon.startswith('/static/uploads/'):
                    image_path = wish.icon[len('/static/uploads/'):]
                else:
                    # 不是上传的图片，可能是内置图标或其他类型，不删除
                    print(f"跳过删除非上传图片: {wish.icon}")
                    # 使用continue的替代方案，直接进入下一个if语句块
                    image_path = None
                
                # 只有在image_path有效且安全检查通过时才继续
                if image_path:
                    # 安全检查：防止路径遍历攻击
                    safe_image_path = os.path.normpath(image_path)
                    if '..' in safe_image_path.split(os.sep):
                        print(f"安全警告：尝试访问受限路径: {image_path}")
                        image_path = None
                
                # 只有在image_path有效且安全检查通过时才继续执行文件删除逻辑
                if image_path and safe_image_path:
                    # 使用绝对路径
                    full_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_image_path)
                    
                    # 再次验证文件路径是否在uploads目录内（额外安全措施）
                    uploads_real_path = os.path.realpath(app.config['UPLOAD_FOLDER'])
                    file_real_path = os.path.realpath(full_path) if os.path.exists(full_path) else ''
                    
                    if file_real_path.startswith(uploads_real_path):
                        try:
                            if os.path.exists(full_path):
                                os.remove(full_path)
                                print(f"删除心愿图片成功: {full_path}")
                            else:
                                print(f"心愿图片不存在: {full_path}")
                        except Exception as e:
                            print(f"删除心愿图片时出错: {str(e)}")
                            # 继续执行，不因图片删除失败而中断删除心愿
                    else:
                        print(f"安全警告：尝试删除uploads目录外的文件: {full_path}")
            except Exception as e:
                print(f"处理心愿图片路径时出错: {str(e)}")
        
        db.session.delete(wish)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '心愿删除成功'})
    
    @app.route('/api/wishes/exchange/<int:wish_id>', methods=['POST'])
    def exchange_wish(wish_id):
        data = request.json
        user_id = data.get('user_id')
        # 获取兑换数量，默认为1
        quantity = data.get('quantity', 1)
        
        # 验证数量参数
        if not isinstance(quantity, int) or quantity <= 0:
            return jsonify({'success': False, 'message': '兑换数量必须是正整数'})
        
        user = User.query.get(user_id)
        wish = Wish.query.get(wish_id)
        
        if not user or not wish:
            return jsonify({'success': False, 'message': '用户或心愿不存在'})
        
        # 计算总金币消耗
        total_cost = wish.cost * quantity
        
        if user.total_gold < total_cost:
            return jsonify({'success': False, 'message': '金币不足'})
        
        # 扣除金币
        user.total_gold -= total_cost
        # 增加兑换次数
        wish.exchange_count += quantity
        
        db.session.commit()
        
        # 记录操作日志，包含兑换数量和单位信息
        if wish.unit:
            total_amount = wish.exchange_amount * quantity if wish.exchange_amount else quantity
            unit_info = f"{total_amount}{wish.unit}"
        else:
            unit_info = str(quantity)
            
        # 获取当前操作用户信息
        current_user = User.query.get(user_id)
        
        log = OperationLog(
            user_id=user_id,
            user_nickname=current_user.nickname or current_user.username if current_user else '未知用户',  # 使用昵称或用户名
            operation_type='兑换心愿',
            operation_content=f'兑换心愿：{wish.name}，消耗{total_cost}金币，兑换{unit_info}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'remaining_gold': user.total_gold, 'total_cost': total_cost, 'quantity': quantity})
    
    @app.route('/api/exchange-history', methods=['GET'])
    def get_exchange_history():
        user_id = request.args.get('user_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        if not user_id:
            return jsonify({'success': False, 'message': '用户ID不能为空'})
        
        # 获取用户信息，用于确定主账号和子账号关系
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 构建查询条件，支持主账号和子账号之间的双向可见性
        # 获取用户及其关联账号（主账号和子账号）的所有兑换记录
        related_user_ids = [user_id]
        
        # 如果是主账号，包含所有子账号的ID
        if user.parent_id is None:
            subaccounts = User.query.filter_by(parent_id=user_id).all()
            related_user_ids.extend([sub.id for sub in subaccounts])
        # 如果是子账号，包含主账号的ID
        elif user.parent_id:
            related_user_ids.append(user.parent_id)
            # 同时包含其他兄弟子账号的ID
            siblings = User.query.filter_by(parent_id=user.parent_id).filter(User.id != user_id).all()
            related_user_ids.extend([sibling.id for sibling in siblings])
        
        # 查询兑换心愿的操作日志，按时间倒序排列
        logs = OperationLog.query.filter(
            OperationLog.user_id.in_(related_user_ids),
            OperationLog.operation_type=='兑换心愿'
        ).order_by(OperationLog.operation_time.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        result = []
        for log in logs.items:
            # 获取用户信息
            log_user = User.query.get(log.user_id)
            username = log_user.username if log_user else f'用户{log.user_id}'
            
            # 从操作内容中提取心愿名称、消耗金币和兑换数量信息
            content = log.operation_content
            
            # 解析心愿名称
            wish_name_match = re.search(r'兑换心愿：([^，]+)', content)
            wish_name = wish_name_match.group(1) if wish_name_match else '未知心愿'
            
            # 解析消耗金币
            cost_match = re.search(r'消耗(\d+)金币', content)
            cost = int(cost_match.group(1)) if cost_match else 0
            
            # 解析兑换数量和单位
            exchange_match = re.search(r'兑换([^，]+)', content)
            exchange_info = exchange_match.group(1) if exchange_match else '未知数量'
            
            # 查询心愿图标信息
            wish_icon = None
            try:
                # 根据心愿名称查询心愿图标
                wish = Wish.query.filter_by(name=wish_name).first()
                if wish:
                    wish_icon = wish.icon
            except Exception as e:
                print(f'查询心愿图标失败: {str(e)}')
            
            result.append({
                'id': log.id,
                'user_id': log.user_id,
                'username': username,
                'wish_name': wish_name,
                'cost': cost,
                'exchange_info': exchange_info,
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_result': log.operation_result,
                'icon': wish_icon
            })
        
        return jsonify({
            'success': True,
            'data': result,
            'total': logs.total,
            'pages': logs.pages,
            'page': page,
            'per_page': per_page
        })
    
    # 金币管理路由
    @app.route('/api/gold/update', methods=['POST'])
    def update_gold():
        data = request.json
        user_id = data.get('user_id')
        amount = data.get('amount')
        reason = data.get('reason')
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 更新金币
        user.total_gold += amount
        
        db.session.commit()
        
        # 记录操作日志
        # 获取用户信息以设置昵称
        current_user = User.query.get(user_id)
        log = OperationLog(
            user_id=user_id,
            user_nickname=current_user.nickname or current_user.username if current_user else '系统',  # 使用昵称或用户名
            operation_type='修改金币',
            operation_content=f'修改金币：{amount}，原因：{reason}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'total_gold': user.total_gold})
    
    # 用户信息路由已在文件开头定义，包含完整用户信息
    
    # 操作记录路由
    @app.route('/api/logs', methods=['GET'])
    def get_operation_logs():
        user_id = request.args.get('user_id', type=int)
        start_time_str = request.args.get('start_time')
        end_time_str = request.args.get('end_time')
        
        if not user_id:
            return jsonify({'success': False, 'message': '缺少user_id参数'})
        
        # 获取用户信息，用于确定主账号和子账号关系
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})
        
        # 构建查询条件，支持主账号和子账号之间的双向可见性
        # 获取用户及其关联账号（主账号和子账号）的所有操作记录
        related_user_ids = [user_id]
        
        # 如果是主账号，包含所有子账号的ID
        if user.parent_id is None:
            subaccounts = User.query.filter_by(parent_id=user_id).all()
            related_user_ids.extend([sub.id for sub in subaccounts])
        # 如果是子账号，包含主账号的ID
        elif user.parent_id:
            related_user_ids.append(user.parent_id)
            # 同时包含其他兄弟子账号的ID
            siblings = User.query.filter_by(parent_id=user.parent_id).filter(User.id != user_id).all()
            related_user_ids.extend([sibling.id for sibling in siblings])
        
        # 构建查询条件，查询所有相关用户的操作记录
        query = OperationLog.query.filter(OperationLog.user_id.in_(related_user_ids))
        
        # 添加时间范围过滤
        if start_time_str:
            try:
                start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
                query = query.filter(OperationLog.operation_time >= start_time)
            except ValueError:
                # 时间格式不正确，忽略该参数
                pass
        
        if end_time_str:
            try:
                end_time = datetime.strptime(end_time_str, '%Y-%m-%d %H:%M:%S')
                query = query.filter(OperationLog.operation_time <= end_time)
            except ValueError:
                # 时间格式不正确，忽略该参数
                pass
        
        # 如果没有提供时间范围，默认获取最近一个月的记录
        if not start_time_str and not end_time_str:
            one_month_ago = datetime.now() - timedelta(days=30)
            query = query.filter(OperationLog.operation_time >= one_month_ago)
        
        # 添加分页
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # 获取总数
        total = query.count()
        
        # 获取分页数据
        pagination = query.order_by(OperationLog.operation_time.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        logs = pagination.items
        result = []
        for log in logs:
            result.append({
                'id': log.id,
                'user_nickname': log.user_nickname,  # 使用用户昵称代替操作人
                'operation_type': log.operation_type,
                'operation_content': log.operation_content,
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_result': log.operation_result,
                'user_id': log.user_id  # 添加用户ID以便前端识别操作来源
            })
        
        return jsonify({
            'success': True, 
            'data': result,
            'total': total,
            'pages': pagination.pages,
            'current_page': page
        })
    
    # 荣誉系统路由
    @app.route('/api/honors/user/<int:user_id>', methods=['GET'])
    def get_user_honors(user_id):
        # 检查用户是否为子账号，如果是则使用父账号ID
        user = User.query.get(user_id)
        effective_user_id = user.parent_id if user and user.parent_id else user_id
        
        user_honors = UserHonor.query.filter_by(user_id=effective_user_id).all()
        
        result = []
        for uh in user_honors:
            result.append({
                'id': uh.honor.id,
                'name': uh.honor.name,
                'description': uh.honor.description,
                'icon': uh.honor.icon,
                'obtained_count': uh.obtained_count,
                'last_obtained': uh.obtained_at.strftime('%Y-%m-%d')
            })
        
        return jsonify(result)
    
    @app.route('/api/honors/all', methods=['GET'])
    def get_all_honors():
        user_id = request.args.get('user_id', type=int)
        honors = Honor.query.all()
        user_honors_map = {}
        
        # 如果提供了user_id，获取用户的荣誉信息
        if user_id:
            # 检查用户是否为子账号，如果是则使用父账号ID
            user = User.query.get(user_id)
            effective_user_id = user.parent_id if user and user.parent_id else user_id
            
            user_honors = UserHonor.query.filter_by(user_id=effective_user_id).all()
            for uh in user_honors:
                user_honors_map[uh.honor_id] = {
                    'obtained_count': uh.obtained_count,
                    'last_obtained': uh.obtained_at.strftime('%Y-%m-%d')
                }
        
        result = []
        for honor in honors:
            honor_data = {
                'id': honor.id,
                'name': honor.name,
                'description': honor.description,
                'icon': honor.icon,
                'condition': honor.condition,
                'is_obtained': honor.id in user_honors_map
            }
            
            # 如果用户已获得该荣誉，添加获得次数和日期
            if honor.id in user_honors_map:
                honor_data.update(user_honors_map[honor.id])
            
            result.append(honor_data)
        
        return jsonify(result)
    
    # 荣誉达成检测路由
    @app.route('/api/honors/check', methods=['POST'])
    def check_and_grant_honors():
        from datetime import datetime, timedelta
        import json
        
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': '用户ID不能为空'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        
        # 检查用户是否为子账号，如果是则使用父账号ID
        effective_user_id = user.parent_id if user.parent_id else user_id
        effective_user = User.query.get(effective_user_id)
        
        # 获取所有荣誉和用户已获得的荣誉
        all_honors = Honor.query.all()
        user_honors = UserHonor.query.filter_by(user_id=effective_user_id).all()
        user_honors_map = {uh.honor_id: uh for uh in user_honors}
        
        # 新获得的荣誉列表
        newly_obtained_honors = []
        
        # 检测每个荣誉的达成条件
        for honor in all_honors:
            # 如果用户已经获得过该荣誉，跳过（可以根据需要修改为可以重复获得）
            # 这里我们允许重复获得，比如连续打卡可以多次获得
            
            # 根据荣誉名称判断达成条件
            is_achieved = False
            
            if honor.name == '连续打卡7天':
                # 检查连续7天完成任务
                today = datetime.now().date()
                consecutive_days = 0
                
                for i in range(7):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    # 检查该日期是否有完成的任务
                    tasks = Task.query.filter_by(
                        user_id=effective_user_id,
                        start_date=check_date_str,
                        status='已完成'
                    ).all()
                    
                    if tasks:
                        consecutive_days += 1
                    else:
                        break
                
                is_achieved = consecutive_days >= 7
            
            elif honor.name == '学习达人':
                # 检查单日学习时长超过3小时（180分钟）
                today = datetime.now().date().strftime('%Y-%m-%d')
                today_tasks = Task.query.filter_by(
                    user_id=effective_user_id,
                    start_date=today,
                    status='已完成'
                ).all()
                
                total_time = sum(task.actual_time for task in today_tasks if task.actual_time)
                is_achieved = total_time >= 180
            
            elif honor.name == '专注达人':
                # 检查单次学习时长超过1小时
                completed_tasks = Task.query.filter_by(
                    user_id=effective_user_id,
                    status='已完成'
                ).all()
                
                max_time = max((task.actual_time for task in completed_tasks if task.actual_time), default=0)
                is_achieved = max_time >= 60
            
            elif honor.name == '全能选手':
                # 检查单日完成所有学科任务
                today = datetime.now().date().strftime('%Y-%m-%d')
                
                # 获取所有学科
                all_subjects = db.session.query(Task.category).filter_by(user_id=effective_user_id).distinct().all()
                all_subjects = [s[0] for s in all_subjects if s[0]]
                
                # 检查每个学科今天是否都有完成的任务
                all_completed = True
                for subject in all_subjects:
                    subject_tasks = Task.query.filter_by(
                        user_id=effective_user_id,
                        start_date=today,
                        category=subject,
                        status='已完成'
                    ).all()
                    
                    if not subject_tasks:
                        all_completed = False
                        break
                
                is_achieved = all_completed and all_subjects
            
            elif honor.name == '积分富翁':
                # 检查累计获得积分超过1000
                is_achieved = effective_user.total_gold >= 1000
            
            elif honor.name == '任务高手':
                # 检查单日完成任务数量超过15个
                today = datetime.now().date().strftime('%Y-%m-%d')
                completed_tasks = Task.query.filter_by(
                    user_id=effective_user_id,
                    start_date=today,
                    status='已完成'
                ).count()
                is_achieved = completed_tasks >= 15
            
            elif honor.name == '勤奋努力':
                # 检查连续30天有打卡记录
                today = datetime.now().date()
                consecutive_days = 0
                
                for i in range(30):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    tasks = Task.query.filter_by(
                        user_id=user_id,
                        start_date=check_date_str
                    ).all()
                    
                    if tasks:
                        consecutive_days += 1
                    else:
                        break
                
                is_achieved = consecutive_days >= 30
            
            elif honor.name == '周末战士':
                # 检查周末连续完成任务
                today = datetime.now().date()
                # 计算最近的周末
                if today.weekday() == 5:  # 周六
                    saturday = today
                    sunday = today + timedelta(days=1)
                elif today.weekday() == 6:  # 周日
                    saturday = today - timedelta(days=1)
                    sunday = today
                else:
                    # 计算距离周六还有几天
                    days_to_saturday = 5 - today.weekday()
                    saturday = today + timedelta(days=days_to_saturday)
                    sunday = saturday + timedelta(days=1)
                
                saturday_tasks = Task.query.filter_by(
                    user_id=user_id,
                    start_date=saturday.strftime('%Y-%m-%d'),
                    status='已完成'
                ).all()
                
                sunday_tasks = Task.query.filter_by(
                    user_id=user_id,
                    start_date=sunday.strftime('%Y-%m-%d'),
                    status='已完成'
                ).all()
                
                is_achieved = len(saturday_tasks) > 0 and len(sunday_tasks) > 0
            
            elif honor.name == '坚持到底':
                # 检查连续完成同一任务30天
                # 这个实现比较复杂，这里简化为检查连续30天都有完成任务
                today = datetime.now().date()
                consecutive_days = 0
                
                for i in range(30):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    tasks = Task.query.filter_by(
                        user_id=user_id,
                        start_date=check_date_str,
                        status='已完成'
                    ).all()
                    
                    if tasks:
                        consecutive_days += 1
                    else:
                        break
                
                is_achieved = consecutive_days >= 30
            
            elif honor.name == '学科之星':
                # 检查单科任务完成率100%
                # 获取用户的所有学科
                subjects = db.session.query(Task.category).filter_by(user_id=user_id).distinct().all()
                subjects = [s[0] for s in subjects if s[0]]
                
                for subject in subjects:
                    # 统计该学科的任务总数和已完成数
                    total_tasks = Task.query.filter_by(user_id=user_id, category=subject).count()
                    completed_tasks = Task.query.filter_by(
                        user_id=user_id, 
                        category=subject, 
                        status='已完成'
                    ).count()
                    
                    # 如果任务数大于5且完成率为100%，则达成条件
                    if total_tasks >= 5 and completed_tasks == total_tasks:
                        is_achieved = True
                        break
            
            elif honor.name == '完美主义':
                # 检查连续5天任务完成率100%
                today = datetime.now().date()
                perfect_days = 0
                
                for i in range(5):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    day_tasks = Task.query.filter_by(
                        user_id=user_id,
                        start_date=check_date_str
                    ).all()
                    
                    if day_tasks:  # 如果当天有任务
                        completed_tasks = [t for t in day_tasks if t.status == '已完成']
                        if len(completed_tasks) == len(day_tasks):
                            perfect_days += 1
                        else:
                            break
                    else:
                        # 如果当天没有任务，不算作完美天
                        break
                
                is_achieved = perfect_days >= 5
            
            elif honor.name == '心愿达人':
                # 检查累计完成心愿10个
                # 查询用户兑换心愿的操作日志
                wish_logs = OperationLog.query.filter_by(
                    user_id=user_id,
                    operation_type='兑换心愿'
                ).count()
                
                is_achieved = wish_logs >= 10
            
            elif honor.name == '持之以恒':
                # 检查连续打卡30天
                today = datetime.now().date()
                consecutive_days = 0
                
                for i in range(30):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    tasks = Task.query.filter_by(
                        user_id=user_id,
                        start_date=check_date_str,
                        status='已完成'
                    ).all()
                    
                    if tasks:
                        consecutive_days += 1
                    else:
                        break
                
                is_achieved = consecutive_days >= 30
            
            elif honor.name == '时间管理':
                # 检查提前完成任务规划
                # 这里简化为检查任务的实际时间是否小于计划时间的80%
                completed_tasks = Task.query.filter_by(
                    user_id=user_id,
                    status='已完成'
                ).filter(Task.planned_time > 0).all()
                
                efficient_tasks = 0
                for task in completed_tasks:
                    if task.actual_time and task.actual_time <= task.planned_time * 0.8:
                        efficient_tasks += 1
                
                is_achieved = efficient_tasks >= 10
            
            elif honor.name == '计划大师':
                # 检查单日规划任务超过20个
                today = datetime.now().date().strftime('%Y-%m-%d')
                today_tasks = Task.query.filter_by(
                    user_id=user_id,
                    start_date=today
                ).count()
                
                is_achieved = today_tasks >= 20
            
            elif honor.name == '进步神速':
                # 检查任务完成率提升20%
                # 这里简化为检查最近7天的完成率是否比之前7天高20%
                today = datetime.now().date()
                
                # 计算最近7天和之前7天的日期范围
                recent_end = today
                recent_start = today - timedelta(days=6)
                previous_end = recent_start - timedelta(days=1)
                previous_start = previous_end - timedelta(days=6)
                
                # 计算最近7天的完成率
                recent_tasks = Task.query.filter(
                    Task.user_id == user_id,
                    Task.start_date >= recent_start.strftime('%Y-%m-%d'),
                    Task.start_date <= recent_end.strftime('%Y-%m-%d')
                ).all()
                
                recent_completed = len([t for t in recent_tasks if t.status == '已完成'])
                recent_rate = recent_completed / len(recent_tasks) * 100 if recent_tasks else 0
                
                # 计算之前7天的完成率
                previous_tasks = Task.query.filter(
                    Task.user_id == user_id,
                    Task.start_date >= previous_start.strftime('%Y-%m-%d'),
                    Task.start_date <= previous_end.strftime('%Y-%m-%d')
                ).all()
                
                previous_completed = len([t for t in previous_tasks if t.status == '已完成'])
                previous_rate = previous_completed / len(previous_tasks) * 100 if previous_tasks else 0
                
                # 检查是否提升了20%
                if previous_rate > 0 and recent_rate >= previous_rate * 1.2:
                    is_achieved = True
            
            elif honor.name == '高效学习':
                # 检查学习效率提升30%
                # 这里简化为检查任务的实际时间是否小于计划时间的70%
                completed_tasks = Task.query.filter_by(
                    user_id=user_id,
                    status='已完成'
                ).filter(Task.planned_time > 0).all()
                
                efficient_tasks = 0
                for task in completed_tasks:
                    if task.actual_time and task.actual_time <= task.planned_time * 0.7:
                        efficient_tasks += 1
                
                is_achieved = efficient_tasks >= 10
            
            elif honor.name == '阅读之星':
                # 检查累计阅读时长超过10小时（600分钟）
                # 假设阅读类任务包含"阅读"关键词或属于语文科目
                reading_tasks = Task.query.filter(
                    Task.user_id == user_id,
                    Task.status == '已完成',
                    Task.name.contains('阅读') | Task.category.contains('语文')
                ).all()
                
                total_reading_time = sum(task.actual_time for task in reading_tasks if task.actual_time)
                is_achieved = total_reading_time >= 600
            
            elif honor.name == '早起鸟':
                # 检查连续7天在早上6点前打卡
                today = datetime.now().date()
                consecutive_early_days = 0
                
                for i in range(7):
                    check_date = today - timedelta(days=i)
                    check_date_str = check_date.strftime('%Y-%m-%d')
                    
                    # 检查该日期最早完成的任务时间
                    early_tasks = Task.query.filter_by(
                        user_id=user_id,
                        start_date=check_date_str,
                        status='已完成'
                    ).all()
                    
                    if early_tasks:
                        # 简化实现：假设有任务就认为是早起打卡
                        consecutive_early_days += 1
                    else:
                        break
                
                is_achieved = consecutive_early_days >= 7
            
            # 如果达成条件
            if is_achieved:
                today = datetime.now().date()
                # 检查是否已经获得过该荣誉
                if honor.id in user_honors_map:
                    # 对于"全能选手"和"学科之星"荣誉，检查今天是否已经获得过
                    if honor.name == '全能选手' or honor.name == '学科之星':
                        last_obtained_date = user_honors_map[honor.id].obtained_at.date()
                        # 只有当上次获得日期不是今天时，才增加计数
                        if last_obtained_date != today:
                            user_honors_map[honor.id].obtained_count += 1
                            user_honors_map[honor.id].obtained_at = datetime.now()
                            # 添加到新获得的荣誉列表
                            newly_obtained_honors.append({
                                'id': honor.id,
                                'name': honor.name,
                                'description': honor.description,
                                'icon': honor.icon
                            })
                    else:
                        # 其他荣誉保持原有逻辑
                        user_honors_map[honor.id].obtained_count += 1
                        user_honors_map[honor.id].obtained_at = datetime.now()
                else:
                    # 创建新的用户荣誉记录
                    new_user_honor = UserHonor(
                        user_id=user_id,
                        honor_id=honor.id,
                        obtained_count=1,
                        obtained_at=datetime.now()
                    )
                    db.session.add(new_user_honor)
                    user_honors_map[honor.id] = new_user_honor
                    
                    # 添加到新获得的荣誉列表
                    newly_obtained_honors.append({
                        'id': honor.id,
                        'name': honor.name,
                        'description': honor.description,
                        'icon': honor.icon
                    })
        
        # 提交数据库更改
        db.session.commit()
        
        # 检查是否达成"成长先锋"荣誉（获得10种不同荣誉）
        if len(user_honors_map) >= 10:
            growth_pioneer = Honor.query.filter_by(name='成长先锋').first()
            if growth_pioneer and growth_pioneer.id not in user_honors_map:
                new_user_honor = UserHonor(
                    user_id=user_id,
                    honor_id=growth_pioneer.id,
                    obtained_count=1,
                    obtained_at=datetime.now()
                )
                db.session.add(new_user_honor)
                db.session.commit()
                
                newly_obtained_honors.append({
                    'id': growth_pioneer.id,
                    'name': growth_pioneer.name,
                    'description': growth_pioneer.description,
                    'icon': growth_pioneer.icon
                })
        
        return jsonify({
            'success': True,
            'new_honors': newly_obtained_honors
        })
    
    # 统计数据路由
    @app.route('/api/statistics', methods=['GET'])
    def get_statistics():
        user_id = request.args.get('user_id')
        date = request.args.get('date')
        
        # 获取用户信息，检查是否是子账号
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': '用户不存在'})
        
        # 如果是子账号，使用父账号的ID来查询数据
        query_user_id = user.parent_id if user.parent_id else user_id
        query_user = User.query.get(query_user_id)
        
        # 计算日统计数据
        day_tasks = Task.query.filter_by(user_id=query_user_id, start_date=date).all()
        
        # 今日总任务个数（所有状态的任务）
        total_count = len(day_tasks)
        # 已完成任务数
        completed_count = sum(1 for task in day_tasks if task.status == '已完成')
        # 今日总时长（仅已完成任务的实际时间总和）
        total_time = sum(task.actual_time for task in day_tasks if task.status == '已完成' and task.actual_time is not None)
        # 完成率
        completion_rate = (completed_count / total_count * 100) if total_count > 0 else 0
        
        # 计算日金币（已完成任务的积分总和）
        day_gold = sum(task.points for task in day_tasks if task.status == '已完成')
        
        return jsonify({
            'day_time': total_time,
            'task_count': total_count,  # 返回今日总任务个数
            'day_gold': day_gold,
            'completion_rate': round(completion_rate, 1),
            'total_gold': query_user.total_gold
        })
    
    # 检查用户名是否可用
    @app.route('/api/check-username', methods=['GET'])
    def check_username_available():
        username = request.args.get('username')
        if not username:
            return jsonify({'available': False, 'message': '用户名不能为空'})
        
        # 验证用户名格式（只允许字母和数字，不少于5个字符）
        if not re.match(r'^[a-zA-Z0-9]{5,}$', username):
            return jsonify({'available': False, 'message': '用户名必须为字母和数字，且长度不少于5个字符'})
        
        # 检查用户名是否已存在
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'available': False, 'message': '用户名已被使用'})
        
        return jsonify({'available': True, 'message': '用户名可用'})
    
    # 创建子账号
    @app.route('/api/users/<int:parent_id>/subaccounts', methods=['POST'])
    def create_subaccount(parent_id):
        try:
            # 验证父账号是否存在
            parent_user = User.query.get(parent_id)
            if not parent_user:
                return jsonify({'success': False, 'message': '父账号不存在'})
            
            # 验证是否为主账号（没有父账号）
            if parent_user.parent_id is not None:
                return jsonify({'success': False, 'message': '只有主账号可以创建子账号'})
            
            # 获取请求数据
            data = request.json
            required_fields = ['username', 'password', 'password_confirm', 'nickname']
            for field in required_fields:
                if field not in data:
                    return jsonify({'success': False, 'message': f'缺少必要参数：{field}'})
            
            # 验证用户名格式
            if not re.match(r'^[a-zA-Z0-9]{5,}$', data['username']):
                return jsonify({'success': False, 'message': '用户名必须为字母和数字，且长度不少于5个字符'})
            
            # 验证用户名是否已存在
            existing_user = User.query.filter_by(username=data['username']).first()
            if existing_user:
                return jsonify({'success': False, 'message': '用户名已被使用'})
            
            # 验证密码一致性
            if data['password'] != data['password_confirm']:
                return jsonify({'success': False, 'message': '两次输入的密码不一致'})
            
            # 创建子账号
            # 注意：前端传递的是permission字段，后端使用permissions字段
            permission = data.get('permission', 'view')
            
            # 确保权限信息以JSON对象格式存储
            permissions = {}
            if permission == 'view':
                permissions = {'view_only': True, 'can_edit': False}
            elif permission == 'edit':
                permissions = {'view_only': False, 'can_edit': True}
            else:
                permissions = {'view_only': True, 'can_edit': False}  # 默认仅查看权限
            
            new_subaccount = User(
                username=data['username'],
                nickname=data['nickname'],
                parent_id=parent_id,
                role='subaccount',
                permissions=json.dumps(permissions)  # 存储权限JSON对象
            )
            new_subaccount.set_password(data['password'])
            
            # 如果有头像，设置头像
            if 'avatar' in data:
                new_subaccount.avatar = data['avatar']
            
            db.session.add(new_subaccount)
            db.session.commit()
            
            # 记录操作日志
            # 获取主账号信息以设置昵称
            parent_user = User.query.get(parent_id)
            log = OperationLog(
                user_id=parent_id,
                user_nickname=parent_user.nickname or parent_user.username if parent_user else '未知用户',  # 使用昵称或用户名
                operation_type='创建子账号',
                operation_content=f'创建子账号：{data["username"]}，权限：{permission}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': '子账号创建成功',
                'subaccount': {
                    'id': new_subaccount.id,
                    'username': new_subaccount.username,
                    'nickname': new_subaccount.nickname,
                    'avatar': new_subaccount.avatar,
                    'permission': permission  # 返回permission而不是permissions
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'创建子账号失败：{str(e)}'})
    
    # 获取子账号列表
    @app.route('/api/users/<int:parent_id>/subaccounts', methods=['GET'])
    def get_subaccounts(parent_id):
        try:
            # 验证父账号是否存在
            parent_user = User.query.get(parent_id)
            if not parent_user:
                return jsonify({'success': False, 'message': '父账号不存在'})
            
            # 验证是否为主账号
            if parent_user.parent_id is not None:
                return jsonify({'success': False, 'message': '只有主账号可以查看子账号列表'})
            
            # 获取子账号列表
            subaccounts = User.query.filter_by(parent_id=parent_id).all()
            subaccounts_list = []
            
            for subaccount in subaccounts:
                subaccounts_list.append({
                    'id': subaccount.id,
                    'username': subaccount.username,
                    'nickname': subaccount.nickname,
                    'avatar': subaccount.avatar,
                    'permissions': json.loads(subaccount.permissions),
                    'created_at': subaccount.created_at.strftime('%Y-%m-%d %H:%M:%S')
                })
            
            return jsonify({
                'success': True,
                'subaccounts': subaccounts_list
            })
        except Exception as e:
            return jsonify({'success': False, 'message': f'获取子账号列表失败：{str(e)}'})
    
    # 删除子账号
    @app.route('/api/users/<int:parent_id>/subaccounts/<int:subaccount_id>', methods=['DELETE'])
    def delete_subaccount(parent_id, subaccount_id):
        try:
            # 验证父账号是否存在
            parent_user = User.query.get(parent_id)
            if not parent_user:
                return jsonify({'success': False, 'message': '父账号不存在'})
            
            # 验证是否为主账号
            if parent_user.parent_id is not None:
                return jsonify({'success': False, 'message': '只有主账号可以删除子账号'})
            
            # 查找子账号
            subaccount = User.query.filter_by(id=subaccount_id, parent_id=parent_id).first()
            if not subaccount:
                return jsonify({'success': False, 'message': '子账号不存在或无权删除'})
            
            # 删除子账号
            username = subaccount.username
            db.session.delete(subaccount)
            db.session.commit()
            
            # 记录操作日志
            log = OperationLog(
                user_id=parent_id,
                user_nickname=parent_user.nickname or parent_user.username if parent_user else '未知用户',  # 使用昵称或用户名
                operation_type='删除子账号',
                operation_content=f'删除子账号：{username}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            db.session.commit()
            
            return jsonify({'success': True, 'message': '子账号删除成功'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'删除子账号失败：{str(e)}'})
    
    # 权限控制装饰器
    def check_permissions(func):
        def wrapper(*args, **kwargs):
            # 从请求中获取用户ID
            user_id = request.args.get('user_id') or request.json.get('user_id')
            if not user_id:
                return jsonify({'success': False, 'message': '缺少用户ID'})
            
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': '用户不存在'})
            
            # 对于子账号，检查权限
            if user.role == 'subaccount' and user.permissions:
                permissions = json.loads(user.permissions)
                # 根据当前请求的URL和方法判断需要的权限
                endpoint = request.endpoint
                method = request.method
                
                # 如果是只读权限，禁用添加、编辑、删除功能
                if permissions.get('type') == 'view_only':
                    if method in ['POST', 'PUT', 'DELETE']:
                        return jsonify({'success': False, 'message': '权限不足，只读账号无法执行此操作'})
            
            return func(*args, **kwargs)
        return wrapper