import sys
import os
# 添加父目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from models import db, OperationLog
from datetime import datetime

# 创建Flask应用
app = Flask(__name__)
# 使用绝对路径确保指向正确的数据库文件
import os
basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
instance_path = os.path.join(basedir, 'instance')
# 确保instance目录存在
if not os.path.exists(instance_path):
    os.makedirs(instance_path)

database_path = os.path.join(instance_path, 'homerecord.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{database_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
print(f"使用数据库路径: {database_path}")

# 初始化数据库
db.init_app(app)

# 添加默认配置
app.config['SECRET_KEY'] = 'your-secret-key'

def migrate_operator_name():
    with app.app_context():
        try:
            # 获取数据库连接
            conn = db.engine.connect()
            
            # 打印所有表名
            result = conn.execute(db.text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = result.fetchall()
            print(f"数据库中的表: {[table[0] for table in tables]}")
            
            # 使用SQLite的方式检查表是否存在（尝试不同的表名格式）
            possible_table_names = ['operation_log', 'operation_logs']
            table_name = None
            
            for possible_name in possible_table_names:
                result = conn.execute(db.text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{possible_name}'"))
                if result.fetchone() is not None:
                    table_name = possible_name
                    break
            
            if not table_name:
                print("未找到操作日志表，跳过迁移")
                return
            
            print(f"找到操作日志表: {table_name}，开始迁移")
            
            # 直接尝试添加列，如果列已存在会自动忽略
            try:
                conn.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN operator_name VARCHAR(50) DEFAULT '未知用户'"))
                conn.commit()
                print("成功添加operator_name列")
            except Exception as e:
                print(f"添加列时出错，可能列已存在: {str(e)}")
            
            # 使用原始SQL更新所有记录的operator_name字段
            try:
                result = conn.execute(db.text(f"UPDATE {table_name} SET operator_name = '未知用户' WHERE operator_name IS NULL"))
                conn.commit()
                print(f"更新了{result.rowcount}条记录的operator_name字段")
            except Exception as e:
                print(f"更新记录时出错: {str(e)}")
            
            print("数据库迁移完成")
            
        except Exception as e:
            print(f"数据库迁移出错: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_operator_name()