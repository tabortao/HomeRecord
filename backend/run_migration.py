import sqlite3
import os

# 使用正确的数据库路径
db_path = os.path.join(os.path.dirname(__file__), 'instance', 'homerecord.db')

try:
    # 连接到正确的数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"连接数据库成功: {db_path}")
    
    # 检查user表的当前结构
    cursor.execute("PRAGMA table_info(user)")
    columns = [column[1] for column in cursor.fetchall()]
    print(f"当前user表字段: {columns}")
    
    # 逐一添加缺失的字段
    if 'nickname' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN nickname TEXT")
        print("添加nickname字段成功")
    
    if 'phone' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN phone TEXT")
        print("添加phone字段成功")
    
    if 'avatar' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN avatar TEXT DEFAULT 'default.svg'")
        print("添加avatar字段成功")
    
    # 为现有记录设置默认值
    cursor.execute("UPDATE user SET nickname = username WHERE nickname IS NULL")
    cursor.execute("UPDATE user SET avatar = 'default.svg' WHERE avatar IS NULL")
    print("更新现有记录默认值成功")
    
    # 提交更改
    conn.commit()
    
    # 验证更新后的结构
    cursor.execute("PRAGMA table_info(user)")
    updated_columns = cursor.fetchall()
    print("\n更新后的user表结构:")
    for column in updated_columns:
        print(f"- {column[1]} ({column[2]})")
    
    # 显示一些示例数据
    cursor.execute("SELECT id, username, nickname, phone, avatar FROM user LIMIT 2")
    print("\n示例用户数据:")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Username: {row[1]}, Nickname: {row[2]}, Phone: {row[3]}, Avatar: {row[4]}")
    
    print("\n数据库迁移完成！")
    
finally:
    # 关闭连接
    if conn:
        conn.close()
        print("数据库连接已关闭")