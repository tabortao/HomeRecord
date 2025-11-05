from models import db, Task
import json
import os
import shutil
from app import app

with app.app_context():
    # 获取所有包含图片的任务
    tasks = Task.query.filter(Task.images.isnot(None)).all()
    
    print(f"开始更新任务图片路径，共找到 {len(tasks)} 个包含图片的任务")
    
    for task in tasks:
        try:
            # 解析图片列表
            images = json.loads(task.images)
            if not images:
                continue
            
            # 新的图片路径列表
            new_images = []
            
            # 更新每个图片路径
            for image_url in images:
                # 检查是否已经是新路径格式
                if '/uploads/task_images/' in image_url:
                    new_images.append(image_url)
                    continue
                
                # 从旧路径中提取文件名
                # 旧格式: /uploads/task_{task_id}/{filename}
                # 新格式: /uploads/task_images/{user_id}/{task_id}/{filename}
                filename = os.path.basename(image_url)
                
                # 构建新旧文件路径
                old_file_path = os.path.join('uploads', f'task_{task.id}', filename)
                new_dir = os.path.join('uploads', 'task_images', str(task.user_id), str(task.id))
                new_file_path = os.path.join(new_dir, filename)
                new_image_url = f'/uploads/task_images/{task.user_id}/{task.id}/{filename}'
                
                # 如果文件存在，移动到新位置
                if os.path.exists(old_file_path):
                    # 确保新目录存在
                    os.makedirs(new_dir, exist_ok=True)
                    # 移动文件
                    shutil.move(old_file_path, new_file_path)
                    print(f"移动文件: {old_file_path} -> {new_file_path}")
                
                # 添加新的图片URL
                new_images.append(new_image_url)
            
            # 更新任务的图片路径
            task.images = json.dumps(new_images)
            print(f"更新任务 {task.id} 的图片路径，共 {len(new_images)} 张图片")
            
        except Exception as e:
            print(f"处理任务 {task.id} 时出错: {e}")
    
    # 提交数据库更改
    db.session.commit()
    print("任务图片路径更新完成！")