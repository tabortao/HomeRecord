from flask import request, jsonify, send_from_directory
from models import db, User, Task, TaskCategory, Wish, OperationLog, Honor, UserHonor
from datetime import datetime, timedelta
import json
import random
import os
import uuid
import re
from werkzeug.utils import secure_filename

def register_routes(app):
    # 确保头像上传根目录存在
    AVATAR_ROOT_FOLDER = 'uploads/avatars'
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
    @app.route('/api/tasks', methods=['GET'])
    def get_tasks_list():
         try:
             user_id = request.args.get('user_id', type=int)
             date = request.args.get('date')
             category = request.args.get('category')
             
             app.logger.info(f"Getting tasks for user_id: {user_id}, date: {date}, category: {category}")
             
             # 构建查询
             query = Task.query.filter_by(user_id=user_id)
             
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
        
        # 检查任务状态是否从非已完成变为已完成
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
        task_points = task.points
        task_status = task.status
        
        # 删除任务相关的图片文件
        if task.images:
            try:
                # 获取当前工作目录，确保使用绝对路径
                current_dir = os.path.dirname(os.path.abspath(__file__))
                
                # 解析图片URL列表
                image_urls = json.loads(task.images)
                print(f"开始处理任务{task_id}的{len(image_urls)}张图片")
                
                # 检查可能的目录结构
                user_dir = os.path.join(current_dir, 'uploads', 'task_images', str(user_id))
                
                # 方法1：直接遍历用户目录下的所有可能子目录，查找包含任务ID的目录
                if os.path.exists(user_dir):
                    task_dirs_to_remove = []
                    for root, dirs, files in os.walk(user_dir):
                        # 检查目录路径中是否包含任务ID
                        if str(task_id) in root:
                            print(f"找到可能包含任务{task_id}图片的目录: {root}")
                            # 记录需要删除的目录
                            task_dirs_to_remove.append(root)
                            # 删除目录中的所有文件
                            for file in files:
                                file_path = os.path.join(root, file)
                                try:
                                    os.remove(file_path)
                                    print(f"成功删除文件: {file_path}")
                                except Exception as e:
                                    print(f"删除文件时出错 {file_path}: {str(e)}")
                    
                    # 删除空目录（从最深层开始删除）
                    for directory in sorted(task_dirs_to_remove, reverse=True):
                        if os.path.exists(directory) and not os.listdir(directory):
                            try:
                                os.rmdir(directory)
                                print(f"成功删除空目录: {directory}")
                            except Exception as e:
                                    print(f"删除目录时出错 {directory}: {str(e)}")
                
                # 方法2：直接从URL构建绝对路径并删除
                for image_url in image_urls:
                    try:
                        # 确保URL是相对路径格式
                        if image_url.startswith('/'):
                            image_url = image_url[1:]  # 移除开头的斜杠
                        
                        # 构建绝对路径
                        file_path = os.path.join(current_dir, image_url)
                        
                        # 也尝试另一种路径格式（直接使用uploads开头）
                        if not file_path.startswith(os.path.join(current_dir, 'uploads')):
                            alt_file_path = os.path.join(current_dir, 'uploads', image_url.replace('uploads/', ''))
                        else:
                            alt_file_path = None
                        
                        # 尝试删除文件
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            print(f"通过直接路径删除成功: {file_path}")
                        elif alt_file_path and os.path.exists(alt_file_path):
                            os.remove(alt_file_path)
                            print(f"通过备用路径删除成功: {alt_file_path}")
                        else:
                            # 尝试不同的URL解析方式
                            if '/uploads/task_images/' in image_url:
                                path_parts = image_url.split('/uploads/task_images/')[1]
                                fallback_path = os.path.join(current_dir, 'uploads', 'task_images', path_parts)
                                if os.path.exists(fallback_path):
                                    os.remove(fallback_path)
                                    print(f"通过备用解析路径删除成功: {fallback_path}")
                                else:
                                    print(f"无法找到文件: {file_path}, {alt_file_path}, {fallback_path}")
                    except Exception as e:
                        print(f"处理URL {image_url} 时出错: {str(e)}")
                        
            except Exception as e:
                print(f"删除图片时出错: {str(e)}")
                # 继续执行任务删除，不因图片删除失败而中断
        
        # 如果是已完成的任务，需要扣除对应的金币
        if task_status == '已完成' and task_points > 0:
            # 获取用户
            user = User.query.get(user_id)
            if user:
                # 扣除金币
                user.total_gold = max(0, user.total_gold - task_points)
                
                # 记录金币扣除日志
                gold_log = OperationLog(
                    user_id=user_id,
                    operation_type='修改金币',
                    operation_content=f'删除已完成任务：{task_name}，扣除{task_points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(gold_log)
        
        # 删除任务记录
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
        upload_folder = os.path.join('uploads', 'task_images', str(task.user_id), str(task_id))
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
        # 使用相对路径存储，便于前端访问
        image_url = f'/uploads/task_images/{task.user_id}/{task_id}/{filename}'
        images.append(image_url)
        task.images = json.dumps(images)
        db.session.commit()
        
        # 记录操作日志
        log = OperationLog(
            user_id=task.user_id,
            operation_type='上传任务图片',
            operation_content=f'为任务{task.name}上传图片',
            operation_time=datetime.now(),
            operation_result='成功'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '图片上传成功', 'image_url': f'/uploads/task_images/{task.user_id}/{task_id}/{filename}'})
    
    # 提供上传文件的访问
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory('uploads', filename)
    
    # 提供带有/api前缀的上传文件访问
    @app.route('/api/uploads/<path:filename>')
    def api_uploaded_file(filename):
        return send_from_directory('uploads', filename)
    
    @app.route('/api/tasks/series/<series_id>', methods=['DELETE'])
    def delete_task_series(series_id):
        tasks = Task.query.filter_by(series_id=series_id).all()
        if not tasks:
            return jsonify({'success': False, 'message': '任务系列不存在'})
        
        user_id = tasks[0].user_id
        total_deducted_points = 0
        # 获取当前工作目录，确保使用绝对路径
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 为每个任务删除对应的图片文件
        for task in tasks:
            if task.images:
                try:
                    # 解析图片URL列表
                    image_urls = json.loads(task.images)
                    print(f"开始处理任务系列中的任务{task.id}的{len(image_urls)}张图片")
                    
                    # 检查可能的目录结构
                    user_dir = os.path.join(current_dir, 'uploads', 'task_images', str(user_id))
                    
                    # 方法1：直接遍历用户目录下的所有可能子目录，查找包含任务ID的目录
                    if os.path.exists(user_dir):
                        task_dirs_to_remove = []
                        for root, dirs, files in os.walk(user_dir):
                            # 检查目录路径中是否包含任务ID
                            if str(task.id) in root:
                                print(f"找到可能包含任务系列中任务{task.id}图片的目录: {root}")
                                # 记录需要删除的目录
                                task_dirs_to_remove.append(root)
                                # 删除目录中的所有文件
                                for file in files:
                                    file_path = os.path.join(root, file)
                                    try:
                                        os.remove(file_path)
                                        print(f"成功删除任务系列中的任务文件: {file_path}")
                                    except Exception as e:
                                        print(f"删除任务系列中的任务文件时出错 {file_path}: {str(e)}")
                        
                        # 删除空目录（从最深层开始删除）
                        for directory in sorted(task_dirs_to_remove, reverse=True):
                            if os.path.exists(directory) and not os.listdir(directory):
                                try:
                                    os.rmdir(directory)
                                    print(f"成功删除任务系列中的空目录: {directory}")
                                except Exception as e:
                                    print(f"删除任务系列中的目录时出错 {directory}: {str(e)}")
                    
                    # 方法2：直接从URL构建绝对路径并删除
                    for image_url in image_urls:
                        try:
                            # 确保URL是相对路径格式
                            if image_url.startswith('/'):
                                image_url = image_url[1:]  # 移除开头的斜杠
                            
                            # 构建绝对路径
                            file_path = os.path.join(current_dir, image_url)
                            
                            # 也尝试另一种路径格式（直接使用uploads开头）
                            if not file_path.startswith(os.path.join(current_dir, 'uploads')):
                                alt_file_path = os.path.join(current_dir, 'uploads', image_url.replace('uploads/', ''))
                            else:
                                alt_file_path = None
                            
                            # 尝试删除文件
                            if os.path.exists(file_path):
                                os.remove(file_path)
                                print(f"通过直接路径删除任务系列中的任务图片成功: {file_path}")
                            elif alt_file_path and os.path.exists(alt_file_path):
                                os.remove(alt_file_path)
                                print(f"通过备用路径删除任务系列中的任务图片成功: {alt_file_path}")
                            else:
                                # 尝试不同的URL解析方式
                                if '/uploads/task_images/' in image_url:
                                    path_parts = image_url.split('/uploads/task_images/')[1]
                                    fallback_path = os.path.join(current_dir, 'uploads', 'task_images', path_parts)
                                    if os.path.exists(fallback_path):
                                        os.remove(fallback_path)
                                        print(f"通过备用解析路径删除任务系列中的任务图片成功: {fallback_path}")
                                    else:
                                        print(f"无法找到任务系列中的任务图片文件: {file_path}, {alt_file_path}, {fallback_path}")
                        except Exception as e:
                            print(f"处理任务系列中的任务图片URL {image_url} 时出错: {str(e)}")
                            
                except Exception as e:
                    print(f"删除任务系列中的任务图片时出错: {str(e)}")
                    # 继续执行，不因图片删除失败而中断
            
            # 检查是否是已完成的任务，如果是则记录需要扣除的金币
            if task.status == '已完成' and task.points > 0:
                total_deducted_points += task.points
                
                # 记录金币扣除日志
                gold_log = OperationLog(
                    user_id=user_id,
                    operation_type='修改金币',
                    operation_content=f'删除任务系列中的已完成任务：{task.name}，扣除{task.points}金币',
                    operation_time=datetime.now(),
                    operation_result='成功'
                )
                db.session.add(gold_log)
            
            # 删除任务记录
            db.session.delete(task)
        
        # 如果有需要扣除的金币，更新用户金币数
        if total_deducted_points > 0:
            user = User.query.get(user_id)
            if user:
                user.total_gold = max(0, user.total_gold - total_deducted_points)
        
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
            
        log = OperationLog(
            user_id=user_id,
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
        user_id = request.args.get('user_id')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        if not user_id:
            return jsonify({'success': False, 'message': '用户ID不能为空'})
        
        # 查询兑换心愿的操作日志，按时间倒序排列
        logs = OperationLog.query.filter_by(
            user_id=user_id,
            operation_type='兑换心愿'
        ).order_by(OperationLog.operation_time.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        result = []
        for log in logs.items:
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
            
            result.append({
                'id': log.id,
                'wish_name': wish_name,
                'cost': cost,
                'exchange_info': exchange_info,
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_result': log.operation_result
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
        start_time_str = request.args.get('start_time')
        end_time_str = request.args.get('end_time')
        
        # 构建查询条件
        query = OperationLog.query.filter(OperationLog.user_id == user_id)
        
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
                'operation_type': log.operation_type,
                'operation_content': log.operation_content,
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_result': log.operation_result
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
        user_honors = UserHonor.query.filter_by(user_id=user_id).all()
        
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
            user_honors = UserHonor.query.filter_by(user_id=user_id).all()
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
        
        # 获取所有荣誉和用户已获得的荣誉
        all_honors = Honor.query.all()
        user_honors = UserHonor.query.filter_by(user_id=user_id).all()
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
                        user_id=user_id,
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
                    user_id=user_id,
                    start_date=today,
                    status='已完成'
                ).all()
                
                total_time = sum(task.actual_time for task in today_tasks if task.actual_time)
                is_achieved = total_time >= 180
            
            elif honor.name == '专注达人':
                # 检查单次学习时长超过1小时
                completed_tasks = Task.query.filter_by(
                    user_id=user_id,
                    status='已完成'
                ).all()
                
                max_time = max((task.actual_time for task in completed_tasks if task.actual_time), default=0)
                is_achieved = max_time >= 60
            
            elif honor.name == '全能选手':
                # 检查单日完成所有学科任务
                today = datetime.now().date().strftime('%Y-%m-%d')
                
                # 获取所有学科
                all_subjects = db.session.query(Task.category).filter_by(user_id=user_id).distinct().all()
                all_subjects = [s[0] for s in all_subjects if s[0]]
                
                # 检查每个学科今天是否都有完成的任务
                all_completed = True
                for subject in all_subjects:
                    subject_tasks = Task.query.filter_by(
                        user_id=user_id,
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
                is_achieved = user.total_gold >= 1000
            
            elif honor.name == '任务高手':
                # 检查单日完成任务数量超过15个
                today = datetime.now().date().strftime('%Y-%m-%d')
                completed_tasks = Task.query.filter_by(
                    user_id=user_id,
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
                # 检查是否已经获得过该荣誉
                if honor.id in user_honors_map:
                    # 增加获得次数
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
            
            new_subaccount = User(
                username=data['username'],
                nickname=data['nickname'],
                parent_id=parent_id,
                role='subaccount',
                permissions=json.dumps(permission)  # 直接存储权限值
            )
            new_subaccount.set_password(data['password'])
            
            # 如果有头像，设置头像
            if 'avatar' in data:
                new_subaccount.avatar = data['avatar']
            
            db.session.add(new_subaccount)
            db.session.commit()
            
            # 记录操作日志
            log = OperationLog(
                user_id=parent_id,
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