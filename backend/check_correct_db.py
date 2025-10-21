import os
import sqlite3

# 检查实际的数据库文件
instance_dir = os.path.join(os.path.dirname(__file__), 'instance')
print(f"检查目录: {instance_dir}")
print("目录中的文件:")
for file in os.listdir(instance_dir):
    print(f"- {file}")

# 尝试连接到正确的数据库文件
db_path = os.path.join(instance_dir, 'homerecord.db')
print(f"\n尝试连接数据库: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("连接成功！")
    
    # 查看数据库中的表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("\n数据库中的表:")
    for table in tables:
        print(f"- {table[0]}")
    
    # 如果有user表，查看其结构
    for table in tables:
        table_name = table[0]
        print(f"\n表 '{table_name}' 的结构:")
        cursor.execute(f"PRAGMA table_info({table_name})")
        for column in cursor.fetchall():
            print(f"  - {column[1]} ({column[2]})")
    
finally:
    if 'conn' in locals():
        conn.close()
        print("\n数据库连接已关闭")