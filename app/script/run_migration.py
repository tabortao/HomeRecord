import sqlite3
import os

# 使用正确的数据库路径 - 向上一级找到instance目录
db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'homerecord.db')
print(f"数据库路径: {db_path}")

try:
    # 确保instance目录存在
    instance_dir = os.path.dirname(db_path)
    if not os.path.exists(instance_dir):
        os.makedirs(instance_dir)
        print(f"创建instance目录: {instance_dir}")
    
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
    
    # 添加子账号相关字段
    if 'parent_id' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN parent_id INTEGER REFERENCES user(id)")
        print("添加parent_id字段成功")
    
    if 'role' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user'")
        print("添加role字段成功")
    
    if 'permissions' not in columns:
        cursor.execute("ALTER TABLE user ADD COLUMN permissions TEXT DEFAULT '{}'")
        print("添加permissions字段成功")
    
    # 为现有记录设置默认值
    cursor.execute("UPDATE user SET nickname = username WHERE nickname IS NULL")
    cursor.execute("UPDATE user SET avatar = 'default.svg' WHERE avatar IS NULL")
    cursor.execute("UPDATE user SET role = 'user' WHERE role IS NULL")
    cursor.execute("UPDATE user SET permissions = '{}' WHERE permissions IS NULL")
    print("更新用户表现有记录默认值成功")
    
    # 检查并更新wish表，添加exchange_amount字段
    cursor.execute("PRAGMA table_info(wish)")
    wish_columns = [column[1] for column in cursor.fetchall()]
    print(f"\n当前wish表字段: {wish_columns}")
    
    if 'exchange_amount' not in wish_columns:
        cursor.execute("ALTER TABLE wish ADD COLUMN exchange_amount INTEGER DEFAULT 1")
        print("添加exchange_amount字段成功")
    
    # 为wish表现有记录设置默认兑换数量
    cursor.execute("UPDATE wish SET exchange_amount = 1 WHERE exchange_amount IS NULL")
    print("更新wish表现有记录默认兑换数量成功")
    
    # 提交更改
    conn.commit()
    
    # 创建索引以提高查询性能
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_parent_id ON user(parent_id)")
        print("创建parent_id索引成功")
    except Exception as e:
        print(f"创建索引时出错: {str(e)}")
    
    # 验证更新后的user表结构
    cursor.execute("PRAGMA table_info(user)")
    updated_columns = cursor.fetchall()
    print("\n更新后的user表结构:")
    for column in updated_columns:
        print(f"- {column[1]} ({column[2]})")
    
    # 验证更新后的wish表结构
    cursor.execute("PRAGMA table_info(wish)")
    wish_updated_columns = cursor.fetchall()
    print("\n更新后的wish表结构:")
    for column in wish_updated_columns:
        print(f"- {column[1]} ({column[2]})")
    
    # 显示一些示例用户数据
    cursor.execute("SELECT id, username, nickname, phone, avatar FROM user LIMIT 2")
    print("\n示例用户数据:")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Username: {row[1]}, Nickname: {row[2]}, Phone: {row[3]}, Avatar: {row[4]}")
    
    # 显示一些示例心愿数据
    cursor.execute("SELECT id, name, cost, unit, exchange_amount FROM wish LIMIT 5")
    print("\n示例心愿数据:")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Name: {row[1]}, Cost: {row[2]}, Unit: {row[3]}, Exchange Amount: {row[4]}")
    
    # 检查并更新honor表，添加icon字段
    cursor.execute("PRAGMA table_info(honor)")
    honor_columns = [column[1] for column in cursor.fetchall()]
    print(f"\n当前honor表字段: {honor_columns}")
    
    if 'icon' not in honor_columns:
        cursor.execute("ALTER TABLE honor ADD COLUMN icon TEXT DEFAULT 'default.png'")
        print("添加icon字段到honor表成功")
    
    # 为honor表现有记录设置默认图标
    cursor.execute("UPDATE honor SET icon = 'default.png' WHERE icon IS NULL")
    print("更新honor表现有记录默认图标成功")
    
    # 验证更新后的honor表结构
    cursor.execute("PRAGMA table_info(honor)")
    honor_updated_columns = cursor.fetchall()
    print("\n更新后的honor表结构:")
    for column in honor_updated_columns:
        print(f"- {column[1]} ({column[2]})")
    
    # 显示一些示例荣誉数据
    cursor.execute("SELECT id, name, description, icon FROM honor LIMIT 5")
    print("\n示例荣誉数据:")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Name: {row[1]}, Description: {row[2]}, Icon: {row[3]}")
    
    print("\n数据库迁移完成！")
    
finally:
    # 关闭数据库连接
    try:
        if 'conn' in locals() and conn:
            conn.close()
            print("数据库连接已关闭")
    except:
        print("关闭数据库连接时出错")