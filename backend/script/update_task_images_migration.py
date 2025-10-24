from app import app
from models import db, Task
from sqlalchemy import text

with app.app_context():
    # 添加images字段到Task表
    try:
        # 检查字段是否已存在
        with db.engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(task)"))
            field_exists = any(field[1] == 'images' for field in result)
            
            if not field_exists:
                # 添加字段
                conn.execute(text("ALTER TABLE task ADD COLUMN images TEXT"))
                conn.commit()
                print("成功添加images字段到Task表")
            else:
                print("images字段已存在")
        
        print("数据库迁移完成")
    except Exception as e:
        print(f"迁移过程中出现错误: {e}")