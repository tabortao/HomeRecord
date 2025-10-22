from flask import request, jsonify, send_from_directory
from models import db, User, Task, TaskCategory, Wish, OperationLog, Honor, UserHonor
from datetime import datetime, timedelta
import json
import random
import os
import uuid
from werkzeug.utils import secure_filename

def register_routes(app):
    # 确保头像上传目录存在
    UPLOAD_FOLDER = 'uploads/avatars'
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
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
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'nickname': user.nickname,
                'phone': user.phone,
                'avatar': user.avatar,
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
            operation_type='更新个人信息',
            operation_content='更新用户个人信息',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '个人信息更新成功'})
    
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
            # 生成唯一文件名
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            
            # 保存文件
            file.save(file_path)
            
            # 更新用户头像信息
            user.avatar = filename
            db.session.commit()
            
            # 记录操作日志
            log = OperationLog(
                user_id=user_id,
                operation_type='上传头像',
                operation_content=f'上传新头像：{filename}',
                operation_time=datetime.now(),
                operation_result='成功'
            )
            db.session.add(log)
            db.session.commit()
            
            return jsonify({'success': True, 'filename': filename, 'message': '头像上传成功'})
        
        return jsonify({'success': False, 'message': '不支持的文件类型'})
    
    # 获取头像路由
    @app.route('/api/avatars/<filename>', methods=['GET'])
    def get_avatar(filename):
        return send_from_directory(UPLOAD_FOLDER, filename)
    
    # 任务相关路由
    # 任务相关路由
    @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
    def update_task(task_id):
        data = request.json
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'success': False, 'message': '任务不存在'})
        
        # 检查任务状态是否从非已完成变为已完成
        was_completed = task.status == '已完成'
        
        # 更新任务信息
        for key, value in data.items():
            if hasattr(task, key) and key != 'id' and key != 'user_id':
                setattr(task, key, value)
        
        task.updated_at = datetime.now()
        
        # 如果任务状态从非已完成变为已完成，增加用户金币
        if not was_completed and task.status == '已完成':
            user = User.query.get(task.user_id)
            if user:
                # 增加金币，任务积分即为金币数量
                user.total_gold += task.points
                
                # 记录金币增加日志
                gold_log = OperationLog(
                    user_id=task.user_id,
                    operation_type='任务完成',
                    operation_content=f'完成任务：{task.name}，获得{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(gold_log)
        
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=task.user_id,
            operation_type='更新任务',
            operation_content=f'更新任务：{task.name}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True})
    
    @app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
    def delete_task(task_id):
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'success': False, 'message': '任务不存在'})
        
        user_id = task.user_id
        task_name = task.name
        
        db.session.delete(task)
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=user_id,
            operation_type='删除任务',
            operation_content=f'删除任务：{task_name}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True})
    
    @app.route('/api/tasks/series/<series_id>', methods=['DELETE'])
    def delete_task_series(series_id):
        tasks = Task.query.filter_by(series_id=series_id).all()
        if not tasks:
            return jsonify({'success': False, 'message': '任务系列不存在'})
        
        user_id = tasks[0].user_id
        
        for task in tasks:
            db.session.delete(task)
        
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=user_id,
            operation_type='删除任务系列',
            operation_content=f'删除任务系列：{series_id}',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True})
    
    # 任务分类相关路由
    @app.route('/api/categories', methods=['GET'])
    def get_categories():
        user_id = request.args.get('user_id')
        
        # 获取内置分类和用户自定义分类
        categories = TaskCategory.query.filter(
            (TaskCategory.is_builtin == True) | (TaskCategory.user_id == user_id)
        ).all()
        
        result = []
        for category in categories:
            result.append({
                'id': category.id,
                'name': category.name,
                'color': category.color,
                'is_builtin': category.is_builtin
            })
        
        return jsonify(result)
    
    @app.route('/api/categories', methods=['POST'])
    def add_category():
        data = request.json
        user_id = data.get('user_id')
        
        # 检查分类名称是否已存在
        if TaskCategory.query.filter_by(name=data.get('name')).first():
            return jsonify({'success': False, 'message': '分类名称已存在'})
        
        category = TaskCategory(
            user_id=user_id,
            name=data.get('name'),
            color=data.get('color', '#999999'),
            is_builtin=False
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({'success': True, 'category': {
            'id': category.id,
            'name': category.name,
            'color': category.color,
            'is_builtin': category.is_builtin
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
    
    # 心愿相关路由
    @app.route('/api/wishes', methods=['GET'])
    def get_wishes():
        user_id = request.args.get('user_id')
        
        # 获取内置心愿和用户自定义心愿
        wishes = Wish.query.filter(
            (Wish.is_builtin == True) | (Wish.user_id == user_id)
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
        
        db.session.delete(wish)
        db.session.commit()
        
        return jsonify({'success': True})
    
    @app.route('/api/wishes/exchange/<int:wish_id>', methods=['POST'])
    def exchange_wish(wish_id):
        data = request.json
        user_id = data.get('user_id')
        
        user = User.query.get(user_id)
        wish = Wish.query.get(wish_id)
        
        if not user or not wish:
            return jsonify({'success': False, 'message': '用户或心愿不存在'})
        
        if user.total_gold < wish.cost:
            return jsonify({'success': False, 'message': '金币不足'})
        
        # 扣除金币
        user.total_gold -= wish.cost
        # 增加兑换次数
        wish.exchange_count += 1
        
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=user_id,
            operation_type='兑换心愿',
            operation_content=f'兑换心愿：{wish.name}，消耗{wish.cost}金币',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'remaining_gold': user.total_gold})
    
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
        log = OperationLog(
            user_id=user_id,
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
        user_id = request.args.get('user_id')
        
        # 获取最近一个月的操作记录
        one_month_ago = datetime.now() - timedelta(days=30)
        logs = OperationLog.query.filter(
            OperationLog.user_id == user_id,
            OperationLog.operation_time >= one_month_ago
        ).order_by(OperationLog.operation_time.desc()).all()
        
        result = []
        for log in logs:
            result.append({
                'id': log.id,
                'operation_type': log.operation_type,
                'operation_content': log.operation_content,
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_result': log.operation_result
            })
        
        return jsonify(result)
    
    # 荣誉系统路由
    @app.route('/api/honors/user/<int:user_id>', methods=['GET'])
    def get_user_honors(user_id):
        user_honors = UserHonor.query.filter_by(user_id=user_id).all()
        
        result = []
        for uh in user_honors:
            result.append({
                'id': uh.honor.id,
                'name': uh.honor.name,
                'description': uh.honor.description,
                'obtained_count': uh.obtained_count,
                'last_obtained': uh.obtained_at.strftime('%Y-%m-%d')
            })
        
        return jsonify(result)
    
    @app.route('/api/honors/all', methods=['GET'])
    def get_all_honors():
        honors = Honor.query.all()
        
        result = []
        for honor in honors:
            result.append({
                'id': honor.id,
                'name': honor.name,
                'description': honor.description
            })
        
        return jsonify(result)
    
    # 统计数据路由
    @app.route('/api/statistics', methods=['GET'])
    def get_statistics():
        user_id = request.args.get('user_id')
        date = request.args.get('date')
        
        # 计算日统计数据
        day_tasks = Task.query.filter_by(user_id=user_id, start_date=date).all()
        
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
        
        user = User.query.get(user_id)
        
        return jsonify({
            'day_time': total_time,
            'task_count': total_count,  # 返回今日总任务个数
            'day_gold': day_gold,
            'completion_rate': round(completion_rate, 1),
            'total_gold': user.total_gold
        })