import os

# 确保任务图片目录结构正确
print("开始检查并创建任务图片目录结构...")

# 确保主目录存在
task_images_dir = 'uploads/task_images'
os.makedirs(task_images_dir, exist_ok=True)
print(f"确保主目录存在: {task_images_dir}")

print("目录结构检查完成！")
print("任务图片现在会按照 'uploads/task_images/{user_id}/{task_id}/' 的结构存储")