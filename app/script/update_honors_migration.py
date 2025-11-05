#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
更新荣誉数据迁移脚本
"""

from app import app, db, Honor
from datetime import datetime

# 新的荣誉数据
new_honors = [
    {'name': '专注达人', 'description': '单次学习时长超过1小时', 'condition': '单次学习时长>60分钟', 'icon': '专注达人.png'},
    {'name': '任务高手', 'description': '单日完成任务数量超过15个', 'condition': '单日完成任务数>15', 'icon': '任务高手.png'},
    {'name': '全能选手', 'description': '单日完成所有学科任务', 'condition': '单日完成所有学科任务', 'icon': '全能选手.png'},
    {'name': '勤奋努力', 'description': '连续30天有打卡记录', 'condition': '连续30天有打卡', 'icon': '勤奋努力.png'},
    {'name': '周末战士', 'description': '周末连续完成任务', 'condition': '周末连续完成任务', 'icon': '周末战士.png'},
    {'name': '坚持到底', 'description': '连续完成同一任务30天', 'condition': '连续完成同一任务30天', 'icon': '坚持到底.png'},
    {'name': '学科之星', 'description': '单科任务完成率100%', 'condition': '单科任务完成率100%', 'icon': '学科之星.png'},
    {'name': '完美主义', 'description': '连续5天任务完成率100%', 'condition': '连续5天任务完成率100%', 'icon': '完美主义.png'},
    {'name': '心愿达人', 'description': '累计完成心愿10个', 'condition': '累计完成心愿10个', 'icon': '心愿达人.png'},
    {'name': '成长先锋', 'description': '累计获得10种不同的荣誉', 'condition': '获得10种不同荣誉', 'icon': '成长先锋.png'},
    {'name': '持之以恒', 'description': '连续打卡30天', 'condition': '连续打卡30天', 'icon': '持之以恒.png'},
    {'name': '时间管理', 'description': '提前完成任务规划', 'condition': '提前完成任务规划', 'icon': '时间管理.png'},
    {'name': '积分富翁', 'description': '累计获得积分超过1000分', 'condition': '累计获得积分>1000', 'icon': '积分富翁.png'},
    {'name': '计划大师', 'description': '单日规划任务超过20个', 'condition': '单日规划任务>20个', 'icon': '计划大师.png'},
    {'name': '进步神速', 'description': '任务完成率提升20%', 'condition': '任务完成率提升20%', 'icon': '进步神速.png'},
    {'name': '高效学习', 'description': '学习效率提升30%', 'condition': '学习效率提升30%', 'icon': '高效学习.png'},
    {'name': '学习达人', 'description': '单日学习时长超过3小时', 'condition': '单日学习时长>180分钟', 'icon': '学习达人.png'},
    {'name': '连续打卡7天', 'description': '连续7天完成学习任务', 'condition': '连续7天完成学习任务', 'icon': '连续打卡7天.png'},
    {'name': '阅读之星', 'description': '累计阅读时长超过10小时', 'condition': '累计阅读时长>600分钟', 'icon': '阅读之星.png'},
    {'name': '早起鸟', 'description': '连续7天在早上6点前打卡', 'condition': '连续7天早上6点前打卡', 'icon': '早起鸟.png'}
]

with app.app_context():
    try:
        print(f"[{datetime.now()}] 开始更新荣誉数据...")
        
        # 获取当前所有荣誉
        existing_honors = Honor.query.all()
        existing_honor_names = {honor.name for honor in existing_honors}
        
        # 创建荣誉名称到对象的映射
        honor_name_map = {honor.name: honor for honor in existing_honors}
        
        # 需要添加的新荣誉
        honors_to_add = []
        # 需要更新的现有荣誉
        honors_to_update = []
        
        for new_honor_data in new_honors:
            honor_name = new_honor_data['name']
            
            if honor_name in existing_honor_names:
                # 更新现有荣誉
                honor = honor_name_map[honor_name]
                honor.description = new_honor_data['description']
                honor.condition = new_honor_data['condition']
                honor.icon = new_honor_data['icon']
                honors_to_update.append(honor)
            else:
                # 添加新荣誉
                new_honor = Honor(**new_honor_data)
                honors_to_add.append(new_honor)
        
        # 执行数据库操作
        if honors_to_add:
            db.session.add_all(honors_to_add)
            print(f"[{datetime.now()}] 添加了 {len(honors_to_add)} 个新荣誉")
        
        if honors_to_update:
            print(f"[{datetime.now()}] 更新了 {len(honors_to_update)} 个现有荣誉")
        
        # 提交更改
        db.session.commit()
        print(f"[{datetime.now()}] 荣誉数据更新成功！")
        
    except Exception as e:
        db.session.rollback()
        print(f"[{datetime.now()}] 荣誉数据更新失败: {str(e)}")
        raise