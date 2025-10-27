import sqlite3
import os
import sys
import traceback

def update_operation_logs():
    try:
        # 数据库文件路径
        db_path = os.path.join(os.path.dirname(__file__), '../instance/homerecord.db')
        
        # 连接到SQLite数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"连接到数据库: {db_path}")
        
        # 获取所有表名
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"数据库中的表: {[table[0] for table in tables]}")
        
        # 查找可能的操作日志表名（更灵活的匹配）
        operation_log_table = None
        possible_names = ['operation_log', 'operation_logs', 'operationlog', 'operationlogs']
        
        for table in tables:
            table_name = table[0]
            if table_name.lower() in [name.lower() for name in possible_names]:
                operation_log_table = table_name
                break
        
        if not operation_log_table:
            print("错误: 未找到操作日志相关的表")
            print("请检查数据库结构，查看实际的表名")
            return False
        
        print(f"找到操作日志表: {operation_log_table}")
        
        # 获取表结构
        cursor.execute(f"PRAGMA table_info({operation_log_table})")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        print(f"表结构: {column_names}")
        
        # 检查并添加user_nickname列
        if 'user_nickname' not in column_names:
            try:
                cursor.execute(f"ALTER TABLE {operation_log_table} ADD COLUMN user_nickname TEXT")
                print("成功添加user_nickname列")
            except sqlite3.OperationalError as e:
                print(f"添加列时出错: {e}")
                return False
        else:
            print("user_nickname列已存在")
        
        # 检查是否有user表（更灵活的匹配）
        user_table = None
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        all_tables = cursor.fetchall()
        
        for table in all_tables:
            table_name = table[0]
            if table_name.lower() in ['user', 'users']:
                user_table = table_name
                break
        
        if user_table:
            print(f"找到用户表: {user_table}")
            
            # 尝试获取用户表结构，确认是否有必要的字段
            cursor.execute(f"PRAGMA table_info({user_table})")
            user_columns = cursor.fetchall()
            user_column_names = [col[1] for col in user_columns]
            
            print(f"用户表结构: {user_column_names}")
            
            # 检查用户表是否有必要的字段
            if 'id' not in user_column_names:
                print("错误: 用户表缺少id字段")
                return False
                
            # 确定使用哪个字段作为显示名称
            display_field = None
            if 'nickname' in user_column_names:
                display_field = 'nickname'
            elif 'username' in user_column_names:
                display_field = 'username'
            else:
                print("错误: 用户表缺少nickname或username字段")
                return False
                
            print(f"使用{display_field}作为显示名称字段")
            
            # 更新有对应用户的记录
            try:
                # 使用子查询更新记录
                update_query = f"""
                    UPDATE {operation_log_table}
                    SET user_nickname = (
                        SELECT {display_field} 
                        FROM {user_table} 
                        WHERE {user_table}.id = {operation_log_table}.user_id
                    )
                    WHERE user_id IN (SELECT id FROM {user_table})
                """
                
                cursor.execute(update_query)
                updated_count = cursor.rowcount
                print(f"更新了{updated_count}条记录，使用用户表中的{display_field}")
                
            except Exception as e:
                print(f"更新记录时出错: {e}")
                traceback.print_exc()
                return False
        else:
            print("未找到用户表，跳过用户信息关联")
        
        # 为没有设置nickname的记录设置默认值
        cursor.execute(f"UPDATE {operation_log_table} SET user_nickname = '未知用户' WHERE user_nickname IS NULL")
        default_updated = cursor.rowcount
        print(f"为{default_updated}条记录设置了默认昵称")
        
        # 提交更改
        conn.commit()
        
        # 统计信息
        cursor.execute(f"SELECT COUNT(*) FROM {operation_log_table}")
        total_count = cursor.fetchone()[0]
        
        print(f"\n迁移完成!")
        print(f"总记录数: {total_count}")
        
        return True
        
    except Exception as e:
        print(f"迁移过程中发生错误: {e}")
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    print("=== 操作日志表迁移脚本 ===")
    print("这个脚本将为操作日志表添加user_nickname字段并更新数据")
    success = update_operation_logs()
    
    if success:
        print("\n✅ 迁移成功完成!")
        sys.exit(0)
    else:
        print("\n❌ 迁移失败!")
        sys.exit(1)
