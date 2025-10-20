// 导入API和工具函数
import * as api from './api.js';
import { dateUtils, timeUtils, storageUtils, domUtils, colorUtils } from './utils.js';

// 当前应用状态
let appState = {
    currentUser: null,
    currentDate: dateUtils.getCurrentDate(),
    currentCategory: '全部学科',
    selectedTaskId: null,
    tomatoTimer: null,
    tomatoTimeLeft: 0,
    tomatoTaskId: null
};

// 初始化应用
function initApp() {
    // 检查用户登录状态
    const savedUser = storageUtils.getUser();
    if (savedUser) {
        appState.currentUser = savedUser;
        showMainApp();
    } else {
        showLoginPage();
    }

    // 绑定事件
    bindEvents();
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

// 显示主应用
function showMainApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // 初始化数据
    initData();
    
    // 更新用户信息显示
    updateUserInfo();
}

// 初始化数据
async function initData() {
    // 加载统计数据
    await loadStatistics();
    
    // 加载任务列表
    await loadTasks();
    
    // 加载分类列表
    await loadCategories();
    
    // 加载周视图
    loadWeekView();
    
    // 加载心愿列表
    await loadWishes();
    
    // 加载荣誉列表
    await loadHonors();
}

// 绑定事件
function bindEvents() {
    // 登录相关事件
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('go-register').addEventListener('click', () => {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });
    document.getElementById('go-login').addEventListener('click', () => {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    });

    // 底部导航栏事件
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            switchPage(page);
        });
    });

    // 周视图切换事件
    document.getElementById('prev-week').addEventListener('click', handlePrevWeek);
    document.getElementById('next-week').addEventListener('click', handleNextWeek);
    document.getElementById('current-date-btn').addEventListener('click', handleCurrentDate);

    // 添加任务按钮事件
    document.getElementById('add-task-btn').addEventListener('click', showAddTaskModal);
    document.getElementById('cancel-task').addEventListener('click', hideAddTaskModal);
    document.getElementById('task-form').addEventListener('submit', handleAddTask);

    // 番茄钟相关事件
    document.getElementById('tomato-start').addEventListener('click', handleTomatoStart);
    document.getElementById('tomato-reset').addEventListener('click', handleTomatoReset);
    document.getElementById('tomato-finish').addEventListener('click', handleTomatoFinish);
    document.getElementById('tomato-bubble').addEventListener('click', showTomatoModal);

    // 小心愿页面事件
    document.getElementById('exchange-history').addEventListener('click', showExchangeHistory);

    // 我的页面事件
    document.getElementById('export-data').addEventListener('click', handleExportData);
    document.getElementById('clear-data').addEventListener('click', handleClearData);
    document.getElementById('operation-logs').addEventListener('click', showOperationLogs);
}

// 处理登录
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        domUtils.showToast('请输入用户名和密码', 'error');
        return;
    }
    
    try {
        const result = await api.userAPI.login(username, password);
        if (result.success) {
            appState.currentUser = result.user;
            storageUtils.saveUser(result.user);
            showMainApp();
            domUtils.showToast('登录成功');
        } else {
            domUtils.showToast(result.message, 'error');
        }
    } catch (error) {
        domUtils.showToast('登录失败，请重试', 'error');
    }
}

// 处理注册
async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!username || !password) {
        domUtils.showToast('请输入用户名和密码', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        domUtils.showToast('两次输入的密码不一致', 'error');
        return;
    }
    
    try {
        const result = await api.userAPI.register(username, password);
        if (result.success) {
            domUtils.showToast('注册成功，请登录');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
        } else {
            domUtils.showToast(result.message, 'error');
        }
    } catch (error) {
        domUtils.showToast('注册失败，请重试', 'error');
    }
}

// 切换页面
function switchPage(page) {
    // 隐藏所有页面
    document.getElementById('task-page').classList.add('hidden');
    document.getElementById('wish-page').classList.add('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    
    // 移除所有导航项的激活状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('nav-item-active');
    });
    
    // 显示选中的页面
    document.getElementById(`${page}-page`).classList.remove('hidden');
    
    // 激活对应的导航项
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('nav-item-active');
    
    // 根据页面显示或隐藏添加按钮
    if (page === 'task') {
        document.getElementById('add-task-btn').style.display = 'flex';
    } else {
        document.getElementById('add-task-btn').style.display = 'none';
    }
}

// 加载统计数据
async function loadStatistics() {
    try {
        const stats = await api.statisticsAPI.getStatistics(appState.currentUser.id, appState.currentDate);
        
        document.getElementById('day-time').textContent = timeUtils.formatMinutes(stats.day_time);
        document.getElementById('task-count').textContent = `${stats.task_count}个`;
        document.getElementById('day-gold').textContent = stats.day_gold;
        document.getElementById('completion-rate').textContent = `${stats.completion_rate}%`;
        document.getElementById('total-gold').textContent = stats.total_gold;
        document.getElementById('wish-gold').textContent = stats.total_gold;
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        const tasks = await api.taskAPI.getTasks(
            appState.currentUser.id,
            appState.currentDate,
            appState.currentCategory
        );
        
        const taskList = document.getElementById('task-list');
        
        if (tasks.length === 0) {
            taskList.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    暂无任务，点击右下角按钮添加
                </div>
            `;
            return;
        }
        
        // 按学科分类任务
        const tasksByCategory = {};
        tasks.forEach(task => {
            if (!tasksByCategory[task.category]) {
                tasksByCategory[task.category] = [];
            }
            tasksByCategory[task.category].push(task);
        });
        
        taskList.innerHTML = '';
        
        // 渲染每个分类的任务
        Object.keys(tasksByCategory).forEach(category => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'mb-6';
            
            // 分类标题
            const categoryHeader = document.createElement('div');
            const categoryColor = colorUtils.getCategoryColor(category);
            categoryHeader.className = 'flex items-center mb-2';
            categoryHeader.innerHTML = `
                <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${categoryColor}"></div>
                <span class="font-medium text-gray-700">${category}</span>
            `;
            categoryElement.appendChild(categoryHeader);
            
            // 任务列表
            tasksByCategory[category].forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'task-card bg-white rounded-lg shadow mb-2 p-3';
                taskElement.dataset.taskId = task.id;
                
                const taskStatusClass = task.status === '已完成' ? 'line-through text-gray-400' : '';
                
                taskElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-medium ${taskStatusClass}">${task.name}</h4>
                            ${task.description ? `<p class="text-xs text-gray-500 mt-1 ${taskStatusClass}">${task.description}</p>` : ''}
                            <div class="flex items-center mt-2 text-xs text-gray-500">
                                <span><i class="fa fa-clock-o mr-1"></i> ${task.planned_time}分钟</span>
                                <span class="mx-2">|</span>
                                <span><i class="fa fa-coins mr-1"></i> ${task.points}金币</span>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="task-tomato p-1 text-green-600" title="番茄钟">
                                <i class="fa fa-play-circle"></i>
                            </button>
                            <button class="task-menu p-1 text-gray-500" title="操作">
                                <i class="fa fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                // 任务状态切换
                taskElement.addEventListener('click', (e) => {
                    // 避免点击操作按钮时触发任务状态切换
                    if (e.target.closest('.task-tomato') || e.target.closest('.task-menu')) {
                        return;
                    }
                    toggleTaskStatus(task.id, task.status);
                });
                
                // 番茄钟按钮
                taskElement.querySelector('.task-tomato').addEventListener('click', (e) => {
                    e.stopPropagation();
                    startTomatoTimer(task);
                });
                
                // 操作菜单按钮
                taskElement.querySelector('.task-menu').addEventListener('click', (e) => {
                    e.stopPropagation();
                    showTaskMenu(task);
                });
                
                categoryElement.appendChild(taskElement);
            });
            
            taskList.appendChild(categoryElement);
        });
    } catch (error) {
        console.error('加载任务列表失败:', error);
    }
}

// 切换任务状态
async function toggleTaskStatus(taskId, currentStatus) {
    const newStatus = currentStatus === '已完成' ? '未完成' : '已完成';
    
    try {
        await api.taskAPI.updateTask(taskId, { status: newStatus });
        
        // 重新加载任务列表和统计数据
        await loadTasks();
        await loadStatistics();
        
        domUtils.showToast('任务状态已更新');
    } catch (error) {
        domUtils.showToast('更新失败，请重试', 'error');
    }
}

// 加载分类列表
async function loadCategories() {
    try {
        const categories = await api.categoryAPI.getCategories(appState.currentUser.id);
        const categoryFilter = document.getElementById('category-filter');
        const taskCategorySelect = document.getElementById('task-category');
        
        // 清空分类过滤器
        categoryFilter.innerHTML = `
            <button class="category-btn px-3 py-1 ${appState.currentCategory === '全部学科' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-full text-sm whitespace-nowrap">全部学科</button>
        `;
        
        // 清空任务分类选择器
        taskCategorySelect.innerHTML = '';
        
        // 添加分类到过滤器和选择器
        categories.forEach(category => {
            // 添加到过滤器
            const filterBtn = document.createElement('button');
            filterBtn.className = `category-btn px-3 py-1 ${appState.currentCategory === category.name ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-full text-sm whitespace-nowrap`;
            filterBtn.textContent = category.name;
            filterBtn.addEventListener('click', () => {
                appState.currentCategory = category.name;
                loadTasks();
                loadCategories(); // 重新加载以更新选中状态
            });
            categoryFilter.appendChild(filterBtn);
            
            // 添加到选择器
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            taskCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载分类列表失败:', error);
    }
}

// 加载周视图
function loadWeekView() {
    const weekDates = dateUtils.getWeekDates(appState.currentDate);
    const weekDaysContainer = document.getElementById('week-days');
    const currentWeekElement = document.getElementById('current-week');
    
    // 更新周信息显示
    currentWeekElement.textContent = dateUtils.getWeekInfo(appState.currentDate);
    
    // 更新日期显示
    weekDaysContainer.innerHTML = '';
    weekDates.forEach(dayInfo => {
        const dayElement = document.createElement('div');
        dayElement.className = `text-center w-1/7 ${dayInfo.isToday ? 'text-green-600 font-bold' : 'text-gray-600'} ${appState.currentDate === dayInfo.date ? 'bg-green-100 rounded-full' : ''}`;
        dayElement.innerHTML = `<div class="mx-auto w-8 h-8 flex items-center justify-center rounded-full">${dayInfo.day}</div>`;
        dayElement.addEventListener('click', () => {
            appState.currentDate = dayInfo.date;
            loadWeekView();
            loadTasks();
            loadStatistics();
        });
        weekDaysContainer.appendChild(dayElement);
    });
}

// 处理上一周
function handlePrevWeek() {
    const prevWeekStart = dateUtils.getPrevWeekStart(appState.currentDate);
    appState.currentDate = prevWeekStart;
    loadWeekView();
    loadTasks();
    loadStatistics();
}

// 处理下一周
function handleNextWeek() {
    const nextWeekStart = dateUtils.getNextWeekStart(appState.currentDate);
    appState.currentDate = nextWeekStart;
    loadWeekView();
    loadTasks();
    loadStatistics();
}

// 返回今天
function handleCurrentDate() {
    appState.currentDate = dateUtils.getCurrentDate();
    loadWeekView();
    loadTasks();
    loadStatistics();
}

// 显示添加任务弹窗
function showAddTaskModal() {
    // 设置默认日期为当前选中的日期
    document.getElementById('task-date').value = appState.currentDate;
    // 清空表单
    document.getElementById('task-form').reset();
    document.getElementById('task-date').value = appState.currentDate;
    document.getElementById('task-time').value = 10;
    document.getElementById('task-points').value = 1;
    
    document.getElementById('add-task-modal').classList.remove('hidden');
}

// 隐藏添加任务弹窗
function hideAddTaskModal() {
    document.getElementById('add-task-modal').classList.add('hidden');
}

// 处理添加任务
async function handleAddTask(e) {
    e.preventDefault();
    
    const taskData = {
        user_id: appState.currentUser.id,
        name: document.getElementById('task-name').value,
        description: document.getElementById('task-description').value,
        category: document.getElementById('task-category').value,
        planned_time: parseInt(document.getElementById('task-time').value),
        points: parseInt(document.getElementById('task-points').value),
        repeat_setting: document.getElementById('task-repeat').value,
        start_date: document.getElementById('task-date').value,
        status: '未完成'
    };
    
    if (!taskData.name) {
        domUtils.showToast('请输入任务名称', 'error');
        return;
    }
    
    try {
        const result = await api.taskAPI.addTask(taskData);
        if (result.success) {
            hideAddTaskModal();
            await loadTasks();
            domUtils.showToast('任务添加成功');
        }
    } catch (error) {
        domUtils.showToast('添加失败，请重试', 'error');
    }
}

// 显示任务菜单
function showTaskMenu(task) {
    appState.selectedTaskId = task.id;
    
    const actions = [
        { name: '编辑任务', icon: 'fa-pencil', action: () => editTask(task) },
        { name: '删除任务', icon: 'fa-trash', action: () => deleteTask(task.id), danger: true }
    ];
    
    // 显示操作菜单（这里简化处理，实际可以实现更复杂的菜单）
    domUtils.showConfirm(
        '任务操作',
        `选择要对任务「${task.name}」执行的操作`,
        () => {
            // 默认执行编辑
            editTask(task);
        },
        () => {}
    );
}

// 编辑任务
function editTask(task) {
    // 这里简化处理，实际可以实现编辑功能
    domUtils.showToast('编辑功能开发中...');
}

// 删除任务
async function deleteTask(taskId) {
    domUtils.showConfirm(
        '确认删除',
        '确定要删除这个任务吗？',
        async () => {
            try {
                await api.taskAPI.deleteTask(taskId);
                await loadTasks();
                await loadStatistics();
                domUtils.showToast('任务已删除');
            } catch (error) {
                domUtils.showToast('删除失败，请重试', 'error');
            }
        }
    );
}

// 开始番茄钟
function startTomatoTimer(task) {
    appState.tomatoTaskId = task.id;
    appState.tomatoTimeLeft = task.planned_time * 60; // 转换为秒
    
    // 更新番茄钟显示
    const tomatoTimerElement = document.getElementById('tomato-timer');
    const bubbleTimerElement = document.getElementById('bubble-timer');
    const tomatoTaskNameElement = document.getElementById('tomato-task-name');
    
    tomatoTaskNameElement.textContent = `番茄钟 - ${task.name}`;
    
    // 格式化时间显示
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    tomatoTimerElement.textContent = formatTime(appState.tomatoTimeLeft);
    bubbleTimerElement.textContent = formatTime(appState.tomatoTimeLeft);
    
    // 显示番茄钟弹窗
    document.getElementById('tomato-modal').classList.remove('hidden');
}

// 处理番茄钟开始
function handleTomatoStart() {
    if (appState.tomatoTimer) {
        // 已经在运行中
        return;
    }
    
    // 开始倒计时
    appState.tomatoTimer = setInterval(() => {
        appState.tomatoTimeLeft--;
        
        if (appState.tomatoTimeLeft <= 0) {
            // 时间到
            clearInterval(appState.tomatoTimer);
            appState.tomatoTimer = null;
            handleTomatoFinish();
            return;
        }
        
        // 更新时间显示
        const mins = Math.floor(appState.tomatoTimeLeft / 60);
        const secs = appState.tomatoTimeLeft % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        document.getElementById('tomato-timer').textContent = timeStr;
        document.getElementById('bubble-timer').textContent = timeStr;
    }, 1000);
    
    // 隐藏弹窗，显示悬浮球
    document.getElementById('tomato-modal').classList.add('hidden');
    document.getElementById('tomato-bubble').classList.remove('hidden');
}

// 处理番茄钟重置
function handleTomatoReset() {
    if (appState.tomatoTimer) {
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
    }
    
    // 重置时间（这里简化处理，实际应该从任务获取原始时间）
    const taskTime = 10 * 60; // 假设10分钟
    appState.tomatoTimeLeft = taskTime;
    
    const timeStr = '00:10';
    document.getElementById('tomato-timer').textContent = timeStr;
    document.getElementById('bubble-timer').textContent = timeStr;
}

// 处理番茄钟完成
async function handleTomatoFinish() {
    if (appState.tomatoTimer) {
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
    }
    
    // 隐藏悬浮球
    document.getElementById('tomato-bubble').classList.add('hidden');
    
    // 更新任务状态为已完成
    if (appState.tomatoTaskId) {
        try {
            await api.taskAPI.updateTask(appState.tomatoTaskId, {
                status: '已完成',
                actual_time: Math.floor((appState.tomatoTimeLeft + 60) / 60) // 转换为分钟
            });
            
            // 重新加载数据
            await loadTasks();
            await loadStatistics();
            
            domUtils.showToast('任务完成！获得金币奖励');
        } catch (error) {
            domUtils.showToast('更新任务失败，请重试', 'error');
        }
    }
    
    // 隐藏弹窗
    document.getElementById('tomato-modal').classList.add('hidden');
}

// 显示番茄钟弹窗
function showTomatoModal() {
    document.getElementById('tomato-modal').classList.remove('hidden');
    document.getElementById('tomato-bubble').classList.add('hidden');
}

// 加载心愿列表
async function loadWishes() {
    try {
        const wishes = await api.wishAPI.getWishes(appState.currentUser.id);
        const wishList = document.getElementById('wish-list');
        
        wishList.innerHTML = '';
        
        wishes.forEach(wish => {
            const wishElement = document.createElement('div');
            wishElement.className = 'bg-white rounded-lg shadow p-3';
            wishElement.innerHTML = `
                <div class="flex items-center mb-2">
                    <img src="static/images/${wish.icon}" alt="${wish.name}" class="w-10 h-10 mr-3">
                    <div>
                        <h4 class="font-medium">${wish.name}</h4>
                        <p class="text-xs text-yellow-500">${wish.cost}金币/${wish.unit}</p>
                    </div>
                </div>
                <p class="text-xs text-gray-500 mb-2">${wish.content}</p>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-400">已兑换 ${wish.exchange_count} 次</span>
                    <button class="wish-exchange px-3 py-1 bg-green-600 text-white rounded-full text-xs" data-wish-id="${wish.id}">
                        立即兑换
                    </button>
                </div>
            `;
            
            // 兑换按钮事件
            wishElement.querySelector('.wish-exchange').addEventListener('click', () => {
                handleExchangeWish(wish.id, wish.name, wish.cost);
            });
            
            wishList.appendChild(wishElement);
        });
    } catch (error) {
        console.error('加载心愿列表失败:', error);
    }
}

// 处理兑换心愿
async function handleExchangeWish(wishId, wishName, cost) {
    const userInfo = await api.userAPI.getUserInfo(appState.currentUser.id);
    
    if (userInfo.user.total_gold < cost) {
        domUtils.showToast('金币不足，无法兑换', 'error');
        return;
    }
    
    domUtils.showConfirm(
        '确认兑换',
        `确定要花费 ${cost} 金币兑换「${wishName}」吗？`,
        async () => {
            try {
                const result = await api.wishAPI.exchangeWish(wishId, appState.currentUser.id);
                if (result.success) {
                    await loadWishes();
                    await loadStatistics();
                    domUtils.showToast('兑换成功！');
                }
            } catch (error) {
                domUtils.showToast('兑换失败，请重试', 'error');
            }
        }
    );
}

// 显示兑换记录
function showExchangeHistory() {
    domUtils.showToast('兑换记录功能开发中...');
}

// 更新用户信息显示
function updateUserInfo() {
    document.getElementById('profile-username').textContent = appState.currentUser.username;
    // 这里应该从API获取最新的用户信息
}

// 加载荣誉列表
async function loadHonors() {
    try {
        const userHonors = await api.honorAPI.getUserHonors(appState.currentUser.id);
        const allHonors = await api.honorAPI.getAllHonors();
        
        const honorList = document.getElementById('honor-list');
        honorList.innerHTML = '';
        
        // 创建用户荣誉的映射
        const userHonorMap = {};
        userHonors.forEach(honor => {
            userHonorMap[honor.id] = honor;
        });
        
        // 显示所有荣誉
        allHonors.forEach(honor => {
            const isObtained = userHonorMap[honor.id] !== undefined;
            const honorElement = document.createElement('div');
            honorElement.className = 'flex flex-col items-center p-2';
            honorElement.innerHTML = `
                <div class="w-12 h-12 rounded-full ${isObtained ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'} flex items-center justify-center mb-1">
                    <i class="fa fa-trophy text-xl"></i>
                </div>
                <span class="text-xs text-center">${honor.name}</span>
                ${isObtained ? `<span class="text-xs text-green-600">x${userHonorMap[honor.id].obtained_count}</span>` : ''}
            `;
            honorList.appendChild(honorElement);
        });
    } catch (error) {
        console.error('加载荣誉列表失败:', error);
    }
}

// 处理导出数据
function handleExportData() {
    domUtils.showToast('导出数据功能开发中...');
}

// 处理清除数据
function handleClearData() {
    domUtils.showConfirm(
        '确认清除',
        '确定要清除所有数据吗？此操作不可恢复！',
        () => {
            domUtils.showToast('清除数据功能开发中...');
        }
    );
}

// 显示操作记录
function showOperationLogs() {
    domUtils.showToast('操作记录功能开发中...');
}

// 启动应用
initApp();