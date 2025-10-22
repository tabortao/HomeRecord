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

// 全局筛选状态
let currentFilter = 'all';

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
    
    // 确保番茄钟悬浮球默认隐藏
    ensureTomatoBubbleHidden();
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    // 登录页不显示悬浮番茄球
    const bubble = document.getElementById('tomato-bubble');
    if (bubble) bubble.classList.add('hidden');
}

// 显示主应用
function showMainApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // 初始化数据
    initData();
    
    // 更新用户信息显示
    updateUserInfo();
    // 确保悬浮球根据页面与计时状态显示或隐藏
        // 确保悬浮球在页面底部中间
        const bubble = document.getElementById('tomato-bubble');
        bubble.style.left = '50%';
        bubble.style.transform = 'translateX(-50%)';
        bubble.style.bottom = '70px';

        // 清理并重新绑定 click 事件（直接移除旧的 listener 并重新绑定）
        const newBubble = bubble.cloneNode(true);
        bubble.parentNode.replaceChild(newBubble, bubble);
        // 重新获取引用
        const boundBubble = document.getElementById('tomato-bubble');
        // 绑定 click：仅在计时中展开 modal
        boundBubble.addEventListener('click', (e) => {
            e.stopPropagation();
            if (appState.tomatoTimer) {
                const modal = document.getElementById('tomato-modal');
                if (modal) modal.classList.remove('hidden');
                // 打开 modal 时临时隐藏悬浮球，避免遮挡
                boundBubble.classList.add('hidden');
            }
        });
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
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                switchPage(page);
            });
        });
    }

    // 周视图切换事件
    if(document.getElementById('prev-week')) document.getElementById('prev-week').addEventListener('click', handlePrevWeek);
    if(document.getElementById('next-week')) document.getElementById('next-week').addEventListener('click', handleNextWeek);
    if(document.getElementById('current-date-btn')) document.getElementById('current-date-btn').addEventListener('click', handleCurrentDate);
    
    // 编辑个人信息相关事件
    if(document.getElementById('edit-profile')) document.getElementById('edit-profile').addEventListener('click', showEditProfileModal);
    if(document.getElementById('cancel-edit-profile')) document.getElementById('cancel-edit-profile').addEventListener('click', hideEditProfileModal);
    if(document.getElementById('edit-profile-form')) document.getElementById('edit-profile-form').addEventListener('submit', handleEditProfile);
    if(document.getElementById('change-avatar-btn')) document.getElementById('change-avatar-btn').addEventListener('click', () => {
        const avatarSelector = document.getElementById('avatar-selector');
        if(avatarSelector) avatarSelector.classList.toggle('hidden');
    });
    
    // 退出登录
    if(document.getElementById('logout')) document.getElementById('logout').addEventListener('click', handleLogout);

    // 添加任务按钮事件
    if(document.getElementById('add-task-btn')) document.getElementById('add-task-btn').addEventListener('click', showAddTaskModal);
    if(document.getElementById('cancel-task')) document.getElementById('cancel-task').addEventListener('click', hideAddTaskModal);
    if(document.getElementById('task-form')) document.getElementById('task-form').addEventListener('submit', handleAddTask);

    // 番茄钟相关事件
    if(document.getElementById('tomato-start')) document.getElementById('tomato-start').addEventListener('click', handleTomatoStart);
    if(document.getElementById('tomato-reset')) document.getElementById('tomato-reset').addEventListener('click', handleTomatoReset);
    if(document.getElementById('tomato-finish')) document.getElementById('tomato-finish').addEventListener('click', handleTomatoFinish);
    if(document.getElementById('tomato-bubble')) document.getElementById('tomato-bubble').addEventListener('click', showTomatoModal);
    if(document.getElementById('tomato-close')) document.getElementById('tomato-close').addEventListener('click', handleTomatoClose);
    
    // 点击番茄钟弹窗外部区域时关闭弹窗并显示悬浮球
    const tomatoModal = document.getElementById('tomato-modal');
    if(tomatoModal) {
        tomatoModal.addEventListener('click', function(e) {
            if (e.target === tomatoModal) {
                hideTomatoModal();
            }
        });
    }

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
            // 更新用户信息显示
            updateUserInfo();
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
    
    // 隐藏所有页面头部
    if(document.getElementById('task-page-header')) document.getElementById('task-page-header').classList.add('hidden');
    if(document.getElementById('wish-page-header')) document.getElementById('wish-page-header').classList.add('hidden');
    if(document.getElementById('profile-page-header')) document.getElementById('profile-page-header').classList.add('hidden');
    
    // 只在作业打卡页面显示统计栏，其他页面隐藏
    const statisticsBar = document.getElementById('statistics-bar');
    if (page === 'task') {
        statisticsBar.classList.remove('hidden');
    } else {
        statisticsBar.classList.add('hidden');
    }
    
    // 显示选中的页面和对应的头部
    document.getElementById(`${page}-page`).classList.remove('hidden');
    if(document.getElementById(`${page}-page-header`)) document.getElementById(`${page}-page-header`).classList.remove('hidden');
    
    // 更新小心愿页面的标题
    if (page === 'wish' && appState.currentUser) {
        const wishPageTitle = document.getElementById('wish-page-title');
        if(wishPageTitle) wishPageTitle.textContent = `「${appState.currentUser.username}」的心愿收集`;
    }
    
    // 移除所有导航项的激活状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('nav-item-active');
    });
    
    // 激活对应的导航项
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('nav-item-active');
    
    // 根据页面显示或隐藏添加按钮
    if (page === 'task') {
        document.getElementById('add-task-btn').style.display = 'flex';
        // 隐藏小心愿添加按钮
        const addWishBtn = document.getElementById('add-wish-btn');
        if (addWishBtn) addWishBtn.style.display = 'none';
    } else if (page === 'wish') {
        document.getElementById('add-task-btn').style.display = 'none';
        // 初始化小心愿页面并显示添加按钮
        initWishPage();
    } else {
        document.getElementById('add-task-btn').style.display = 'none';
        // 隐藏小心愿添加按钮
        const addWishBtn = document.getElementById('add-wish-btn');
        if (addWishBtn) addWishBtn.style.display = 'none';
    }

    // 更新番茄钟悬浮球显示状态（在页面切换时）
    ensureTomatoBubbleHidden();
    // 额外显式设置 display，确保在受限页面彻底隐藏
    const bubbleEl = document.getElementById('tomato-bubble');
    if (bubbleEl) {
        const hiddenPages = ['task', 'wish', 'profile', 'login'];
        if (hiddenPages.includes(page)) {
            bubbleEl.style.display = 'none';
        } else {
            // 只有在计时中才显示
            bubbleEl.style.display = appState.tomatoTimer ? 'flex' : 'none';
        }
    }
}

// 加载统计数据
async function loadStatistics() {
    try {
        if (!appState.currentUser) {
            console.log('用户未登录，跳过加载统计数据');
            return;
        }
        
        const date = appState.currentDate || dateUtils.getCurrentDate();
        // 使用与其他API调用相同的基础URL格式
        const url = `http://localhost:5000/api/statistics?user_id=${appState.currentUser.id}&date=${date}`;
        console.log('请求统计数据URL:', url, '用户ID:', appState.currentUser.id, '日期:', date);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`获取统计数据失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('统计数据:', data);

        // 日时长 - 统计今日各任务时间花费总和
        const dayTimeElement = document.getElementById('day-time');
        if (dayTimeElement) {
            dayTimeElement.textContent = `${data.day_time || 0}分钟`;
        }

        // 任务数 - 显示今日总任务个数
        const taskCountElement = document.getElementById('task-count');
        if (taskCountElement) {
            taskCountElement.textContent = `${data.task_count || 0}个`;
        }

        // 日金币 - 统计今日获得的金币总数
        const dayGoldElement = document.getElementById('day-gold');
        if (dayGoldElement) {
            dayGoldElement.textContent = data.day_gold || 0;
        }

        // 完成率
        const completionRateElement = document.getElementById('completion-rate');
        if (completionRateElement) {
            completionRateElement.textContent = `${data.completion_rate || 0}%`;
        }

        // 调用updateUserInfo函数确保金币数据一致性
        await updateUserInfo();

        // 添加简单的动画效果
        const statElements = document.querySelectorAll('#statistics-bar > div > div');
        statElements.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('stat-item');
            }, index * 100);
        });

    } catch (error) {
        console.error('加载统计数据错误:', error);
        console.log('错误详情:', error.message, error.stack);
    }
}

// 加载任务列表
async function loadTasks() {
    try {
        // 确保首次加载时使用默认的全部学科分类
        if (appState.currentCategory === undefined) {
            appState.currentCategory = '';
        }
        
        const tasks = await api.taskAPI.getTasks(
            appState.currentUser.id,
            appState.currentDate,
            appState.currentCategory
        );
        
        const taskList = document.getElementById('task-list');
        const isToday = appState.currentDate === dateUtils.getCurrentDate();
        
        // 添加任务筛选器 - 调整布局：今日任务和筛选器在同一行
        taskList.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                ${isToday ? '<h3 class="text-lg font-medium">今日任务</h3>' : ''}
                <div class="flex space-x-2">
                    <button id="filter-all" class="px-3 py-1 rounded-full bg-green-600 text-white text-sm">全部</button>
                    <button id="filter-completed" class="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm">已完成</button>
                    <button id="filter-pending" class="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm">待完成</button>
                </div>
            </div>
        `;
        
        // 绑定筛选器事件
        // currentFilter 已定义为全局变量
        
        // 筛选器点击事件
        document.getElementById('filter-all').addEventListener('click', () => {
            currentFilter = 'all';
            updateFilterButtons();
            filterAndRenderTasks(tasks, 'all');
        });
        
        document.getElementById('filter-completed').addEventListener('click', () => {
            currentFilter = 'completed';
            updateFilterButtons();
            filterAndRenderTasks(tasks, 'completed');
        });
        
        document.getElementById('filter-pending').addEventListener('click', () => {
            currentFilter = 'pending';
            updateFilterButtons();
            filterAndRenderTasks(tasks, 'pending');
        });
        
        // 更新筛选按钮激活状态
        function updateFilterButtons() {
            document.getElementById('filter-all').className = currentFilter === 'all' ? 'px-3 py-1 rounded-full bg-green-600 text-white text-sm font-medium' : 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium';
            document.getElementById('filter-completed').className = currentFilter === 'completed' ? 'px-3 py-1 rounded-full bg-green-600 text-white text-sm font-medium' : 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium';
            document.getElementById('filter-pending').className = currentFilter === 'pending' ? 'px-3 py-1 rounded-full bg-green-600 text-white text-sm font-medium' : 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium';
        }
        
        // 确保在修改前保存当前分类状态
        const currentCategoryState = appState.currentCategory;
        
        document.getElementById('filter-all').addEventListener('click', () => {
            currentFilter = 'all';
            updateTaskFilterButtons();
            // 重置分类状态为全部学科
            appState.currentCategory = '';
            filterAndRenderTasks(tasks, currentFilter);
        });
        
        document.getElementById('filter-completed').addEventListener('click', () => {
            currentFilter = 'completed';
            updateTaskFilterButtons();
            // 重置分类状态为全部学科
            appState.currentCategory = '';
            filterAndRenderTasks(tasks, currentFilter);
        });
        
        document.getElementById('filter-pending').addEventListener('click', () => {
            currentFilter = 'pending';
            updateTaskFilterButtons();
            // 重置分类状态为全部学科
            appState.currentCategory = '';
            filterAndRenderTasks(tasks, currentFilter);
        });
        
        // 恢复分类状态
        appState.currentCategory = currentCategoryState;
        
        // 初始渲染任务
        filterAndRenderTasks(tasks, currentFilter);
        
    } catch (error) {
        console.error('加载任务列表失败:', error);
        taskList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                加载失败，请重试
            </div>
        `;
    }
}

// 更新筛选按钮状态
function updateTaskFilterButtons() {
    const buttons = {
        'all': document.getElementById('filter-all'),
        'completed': document.getElementById('filter-completed'),
        'pending': document.getElementById('filter-pending')
    };
    
    Object.entries(buttons).forEach(([key, button]) => {
        if (button) {
            if (key === currentFilter) {
                button.className = 'px-3 py-1 rounded-full bg-green-600 text-white text-sm';
            } else {
                button.className = 'px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm';
            }
        }
    });
}

// 筛选并渲染任务
function filterAndRenderTasks(tasks, filter) {
    // 根据筛选条件过滤任务
    let filteredTasks = [...tasks];
    if (filter === 'completed') {
        filteredTasks = tasks.filter(task => task.status === '已完成');
    } else if (filter === 'pending') {
        filteredTasks = tasks.filter(task => task.status === '未完成');
    }
    
    // 清空现有任务列表（保留筛选器）
    const taskList = document.getElementById('task-list');
    const filterSection = taskList.querySelector('div');
    taskList.innerHTML = '';
    taskList.appendChild(filterSection);
    
    if (filteredTasks.length === 0) {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'text-center text-gray-500 py-8';
        emptyElement.textContent = filter === 'all' ? '暂无任务，点击右下角按钮添加' : '暂无相关任务';
        taskList.appendChild(emptyElement);
        return;
    }
    
    // 按学科分类任务
    const tasksByCategory = {};
    filteredTasks.forEach(task => {
        if (!tasksByCategory[task.category]) {
            tasksByCategory[task.category] = [];
        }
        tasksByCategory[task.category].push(task);
    });
    
    // 添加分类过滤器 - 仅在有任务时显示
    const categoriesElement = document.createElement('div');
    categoriesElement.className = 'mb-4';
    categoriesElement.innerHTML = '<div class="flex flex-wrap gap-2">';
    
    // 获取所有分类
    const categories = ['全部学科', ...Object.keys(tasksByCategory)];
    categories.forEach(category => {
        // 正确处理'全部学科'的选中状态
        const isActive = appState.currentCategory === (category === '全部学科' ? '' : category);
        const categoryButton = document.createElement('button');
        categoryButton.className = `px-3 py-1 rounded-full text-sm ${isActive ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`;
        categoryButton.textContent = category;
        categoryButton.addEventListener('click', () => {
            appState.currentCategory = category === '全部学科' ? '' : category;
            loadTasks();
        });
        categoriesElement.querySelector('div').appendChild(categoryButton);
    });
    
    taskList.appendChild(categoriesElement);
    
    // 移除原始的分类加载函数调用（因为我们现在直接在筛选函数中处理分类）
    // loadCategories(); // 不再需要这个函数
    
    // 渲染每个分类的任务
    Object.keys(tasksByCategory).forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'mb-6';
        
        // 分类标题 - 添加到筛选器下方
        const categoryHeader = document.createElement('div');
        const categoryColor = colorUtils.getCategoryColor(category);
        categoryHeader.className = 'flex items-center mb-2';
        categoryHeader.innerHTML = `
            <div class="w-4 h-4 rounded-full mr-2 flex items-center justify-center" style="background-color: ${categoryColor}"></div>
            <span class="font-semibold text-gray-800 text-lg">${category}</span>
        `;
        categoryElement.appendChild(categoryHeader);
        
        // 任务列表
        tasksByCategory[category].forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-card bg-white p-4 mb-3 shadow-sm rounded-xl border-2 border-transparent hover:border-green-300 transition-all duration-200';
            taskElement.dataset.taskId = task.id;
            
            // 任务完成状态
            const isCompleted = task.status === '已完成';
            const iconClass = isCompleted ? 'fa-check-circle' : 'fa-circle-o';
            const statusClass = isCompleted ? 'text-green-500' : 'text-gray-400';
            const taskStatusClass = isCompleted ? 'line-through text-gray-400' : '';
            
            taskElement.innerHTML = `
                <div class="flex items-start">
                    <div class="mr-3 mt-1">
                        <i class="fa ${iconClass} ${statusClass} text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-medium text-base ${taskStatusClass}">${task.name}</h4>
                                ${task.description ? `<p class="text-sm text-gray-500 mt-1 ${taskStatusClass}">${task.description}</p>` : ''}
                            </div>
                            <div class="flex items-center space-x-3">
                                <div class="flex items-center text-sm text-purple-600 font-medium">
                                    <i class="fa fa-clock-o mr-1"></i>
                                    <span>${task.planned_time}分钟</span>
                                </div>
                                <div class="flex items-center text-sm text-yellow-500 font-bold">
                                    <i class="fa fa-star mr-1"></i>
                                    <span>${task.points}分</span>
                                </div>
                                <button class="task-tomato p-1 hover:bg-green-100 rounded-full transition-colors duration-200" title="番茄钟">
                                    <img src="static/images/番茄钟.png" alt="番茄钟" class="w-5 h-5">
                                </button>
                                <button class="task-menu p-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors duration-200" title="操作">
                                    <i class="fa fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // 任务状态切换 - 仅在点击复选框图标时切换状态
            const statusIcon = taskElement.querySelector('.fa-circle-o, .fa-check-circle');
            if (statusIcon) {
                statusIcon.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    toggleTaskStatus(task.id, task.status);
                });
            }
            
            // 卡片点击事件 - 不再触发状态切换
            taskElement.addEventListener('click', (e) => {
                // 避免在点击番茄钟按钮、菜单按钮或复选框时触发其他操作
                if (e.target.closest('.task-tomato') || e.target.closest('.task-menu') || 
                    e.target.closest('.fa-circle-o') || e.target.closest('.fa-check-circle')) {
                    return;
                }
                // 这里可以添加其他点击卡片需要执行的操作
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
}

// 切换任务状态
async function toggleTaskStatus(taskId, currentStatus) {
    const newStatus = currentStatus === '已完成' ? '未完成' : '已完成';
    
    try {
        // 先获取任务信息（用于金币与时间处理）
        const tasks = await api.taskAPI.getTasks(appState.currentUser.id, appState.currentDate, '');
        const task = tasks.find(t => t.id === taskId);

        // 如果是标记为已完成，且没有使用番茄钟，则使用计划时间作为实际时间
        if (newStatus === '已完成') {
            if (task && !task.used_tomato) {
                await api.taskAPI.updateTask(taskId, { 
                    status: newStatus,
                    actual_time: task.planned_time, // 直接使用计划时间
                    used_tomato: false // 标记未使用番茄钟
                });
            } else {
                await api.taskAPI.updateTask(taskId, { status: newStatus });
            }
        } else {
            // 从 已完成 -> 未完成：需要撤销已发放的金币（如果有）
            if (currentStatus === '已完成' && task) {
                const deduct = -(task.points || 0);
                if (deduct !== 0) {
                    // 在UI上先显示临时扣除，提升响应感
                    try {
                        const dayEl = document.getElementById('day-gold');
                        const totalEl = document.getElementById('total-gold');
                        if (dayEl) dayEl.textContent = Math.max(0, (parseInt(dayEl.textContent || '0', 10) + deduct)).toString();
                        if (totalEl) totalEl.textContent = Math.max(0, (parseInt(totalEl.textContent || '0', 10) + deduct)).toString();
                    } catch (e) {
                        // ignore formatting errors
                    }

                    // 调用后端接口撤销金币
                    try {
                        await api.goldAPI.updateGold(appState.currentUser.id, deduct, 'revoke_task');
                    } catch (err) {
                        console.error('撤销金币请求失败', err);
                        // 失败则继续，但后续的 loadStatistics/updateUserInfo 会修正显示
                    }
                }
            }
            // 最后更新任务状态
            await api.taskAPI.updateTask(taskId, { status: newStatus });
        }
        
        // 重新加载任务列表和统计数据
        await loadTasks();
        await loadStatistics();
        await updateUserInfo(); // 确保金币数据一致性
        
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
        
        // 只在元素存在时才操作
        if (categoryFilter) {
            // 清空分类过滤器
            categoryFilter.innerHTML = `
                <button class="category-btn px-3 py-1 ${appState.currentCategory === '全部学科' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-full text-sm whitespace-nowrap">全部学科</button>
            `;
        }
        
        // 清空任务分类选择器
        if (taskCategorySelect) {
            taskCategorySelect.innerHTML = '';
        }
        
        // 添加分类到过滤器和选择器
        categories.forEach(category => {
            // 添加到过滤器
            if (categoryFilter) {
                const filterBtn = document.createElement('button');
                filterBtn.className = `category-btn px-3 py-1 ${appState.currentCategory === category.name ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-full text-sm whitespace-nowrap`;
                filterBtn.textContent = category.name;
                filterBtn.addEventListener('click', () => {
                    appState.currentCategory = category.name;
                    loadTasks();
                    loadCategories(); // 重新加载以更新选中状态
                });
                categoryFilter.appendChild(filterBtn);
            }
            
            // 添加到选择器
            if (taskCategorySelect) {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                taskCategorySelect.appendChild(option);
            }
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
    
    // 更新周信息显示 - 添加本周按钮并居中
    currentWeekElement.innerHTML = `
        <div class="flex justify-center items-center">
            <span style="font-weight: normal;">${dateUtils.getWeekInfo(appState.currentDate)}</span>
            <button id="current-week-btn" class="text-xs px-2 py-1 ml-2 rounded-full bg-green-100 text-green-600">本周</button>
        </div>
    `;
    
    // 绑定本周按钮事件
    const currentWeekBtn = document.getElementById('current-week-btn');
    if (currentWeekBtn) {
        currentWeekBtn.addEventListener('click', handleCurrentDate);
    }
    
    // 更新日期显示
    weekDaysContainer.innerHTML = '';
    weekDates.forEach(dayInfo => {
        const dayElement = document.createElement('div');
        const isSelected = appState.currentDate === dayInfo.date;
        // 确保显示有效的星期几，避免undefined
        const weekday = dayInfo.weekday || '';
        dayElement.className = `text-center w-1/7 ${dayInfo.isToday ? 'text-green-600 font-bold' : 'text-gray-600'}`;
        dayElement.innerHTML = `
            <div class="text-xs mb-1">${weekday}</div>
            <div class="mx-auto w-8 h-8 flex items-center justify-center rounded-full ${isSelected ? 'bg-green-100 text-green-600 font-bold' : ''}">${dayInfo.day || ''}</div>
        `;
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
async function handleCurrentDate() {
    appState.currentDate = dateUtils.getCurrentDate();
    loadWeekView();
    await loadTasks();
    await loadStatistics();
}

// 显示添加任务弹窗
function showAddTaskModal() {
    // 设置弹窗标题为添加任务
    document.getElementById('modal-title').textContent = '添加任务';
    
    // 设置默认日期为当天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('task-date').value = today;
    
    // 清空表单
    document.getElementById('task-form').reset();
    
    // 重新设置默认值
    document.getElementById('task-date').value = today;
    document.getElementById('task-time').value = 10;
    document.getElementById('task-points').value = 1;
    document.getElementById('task-end-date').value = '';
    
    // 重置重复设置复选框 - 默认选中"无"
    document.querySelectorAll('input[name="task-repeat"]').forEach(checkbox => {
        checkbox.checked = false;
        updateCheckboxStyle(checkbox);
    });
    // 默认选中"无"
    const noneCheckbox = document.getElementById('repeat-none');
    if (noneCheckbox) {
        noneCheckbox.checked = true;
        updateCheckboxStyle(noneCheckbox);
    }
    
    // 重置表单状态
    document.getElementById('task-form').dataset.editMode = 'false';
    document.getElementById('task-form').dataset.taskId = '';
    
    document.getElementById('add-task-modal').classList.remove('hidden');
    
    // 添加键盘事件监听，处理输入法弹出
    setTimeout(() => {
        adjustModalPosition();
    }, 100);
}

// 隐藏添加任务弹窗
function hideAddTaskModal() {
    document.getElementById('add-task-modal').classList.add('hidden');
}

// 为关闭按钮添加事件监听
document.getElementById('close-modal')?.addEventListener('click', hideAddTaskModal);

// 更新复选框样式
function updateCheckboxStyle(checkbox) {
    const label = checkbox.closest('label');
    if (checkbox.checked) {
        label.classList.add('bg-indigo-600', 'text-white');
        label.classList.remove('bg-gray-100');
    } else {
        label.classList.remove('bg-indigo-600', 'text-white');
        label.classList.add('bg-gray-100');
    }
}

// 添加重复设置复选框互斥逻辑和样式更新
document.addEventListener('DOMContentLoaded', () => {
    // 获取所有重复设置复选框
    const repeatCheckboxes = document.querySelectorAll('input[name="task-repeat"]');
    // 基础重复选项（无、每天、每个工作日）
    const basicRepeatOptions = ['repeat-none', 'repeat-daily', 'repeat-weekday'];
    // 星期重复选项
    const weekdayRepeatOptions = ['repeat-mon', 'repeat-tue', 'repeat-wed', 'repeat-thu', 'repeat-fri', 'repeat-sat', 'repeat-sun'];
    
    repeatCheckboxes.forEach(checkbox => {
        // 初始化样式
        updateCheckboxStyle(checkbox);
        
        checkbox.addEventListener('change', function() {
            // 更新当前复选框样式
            updateCheckboxStyle(this);
            
            // 互斥逻辑：如果选中任何一个基础选项或星期选项
            if (this.checked) {
                // 1. 如果选中"无"，取消选中所有其他选项
                if (this.id === 'repeat-none') {
                    repeatCheckboxes.forEach(cb => {
                        if (cb.id !== 'repeat-none') {
                            cb.checked = false;
                            updateCheckboxStyle(cb);
                        }
                    });
                }
                // 2. 如果选中"每天"或"每个工作日"，取消选中"无"和其他基础选项
                else if (basicRepeatOptions.includes(this.id) && this.id !== 'repeat-none') {
                    // 取消选中"无"
                    const noneCheckbox = document.getElementById('repeat-none');
                    if (noneCheckbox) {
                        noneCheckbox.checked = false;
                        updateCheckboxStyle(noneCheckbox);
                    }
                    // 取消选中其他基础选项
                    basicRepeatOptions.forEach(id => {
                        if (id !== this.id && id !== 'repeat-none') {
                            const cb = document.getElementById(id);
                            if (cb) {
                                cb.checked = false;
                                updateCheckboxStyle(cb);
                            }
                        }
                    });
                    // 取消选中所有星期选项
                    weekdayRepeatOptions.forEach(id => {
                        const cb = document.getElementById(id);
                        if (cb) {
                            cb.checked = false;
                            updateCheckboxStyle(cb);
                        }
                    });
                }
                // 3. 如果选中任何星期选项，取消选中"无"、"每天"和"每个工作日"
                else if (weekdayRepeatOptions.includes(this.id)) {
                    // 取消选中所有基础选项
                    basicRepeatOptions.forEach(id => {
                        const cb = document.getElementById(id);
                        if (cb) {
                            cb.checked = false;
                            updateCheckboxStyle(cb);
                        }
                    });
                }
            } else {
                // 如果取消选中某个选项，检查是否需要自动选中"无"
                const hasAnyChecked = Array.from(repeatCheckboxes).some(cb => cb.checked);
                if (!hasAnyChecked) {
                    const noneCheckbox = document.getElementById('repeat-none');
                    if (noneCheckbox) {
                        noneCheckbox.checked = true;
                        updateCheckboxStyle(noneCheckbox);
                    }
                }
            }
        });
    });
});

// 调整弹窗位置，处理输入法弹出
function adjustModalPosition() {
    const modal = document.getElementById('add-task-modal');
    const modalContent = modal?.querySelector('.bg-white');
    
    if (!modal || !modalContent) return;
    
    // 监听窗口大小变化和滚动事件
    const handleResizeOrScroll = () => {
        // 在移动设备上，动态调整弹窗位置
        if (window.innerWidth <= 768) {
            // 获取当前活跃的输入元素
            const activeElement = document.activeElement;
            
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                // 延迟一点时间，确保输入法已经弹出
                setTimeout(() => {
                    const activeElementRect = activeElement.getBoundingClientRect();
                    const modalContentRect = modalContent.getBoundingClientRect();
                    
                    // 检查输入元素是否被遮挡
                    if (activeElementRect.bottom > modalContentRect.bottom - 50) {
                        // 计算需要滚动的距离
                        const scrollDistance = activeElementRect.bottom - modalContentRect.bottom + 50;
                        modalContent.scrollTop += scrollDistance;
                    }
                }, 300);
            }
        }
    };
    
    // 添加事件监听器
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll);
    
    // 在弹窗关闭时移除事件监听器
    const cleanup = () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll);
        modal.removeEventListener('hidden', cleanup);
    };
    
    // 监听弹窗隐藏事件
    modal.addEventListener('hidden', cleanup);
}

// 处理添加任务或编辑任务
async function handleAddTask(e) {
    e.preventDefault();
    
    const taskForm = document.getElementById('task-form');
    const isEditMode = taskForm?.dataset.editMode === 'true';
    const taskId = taskForm?.dataset.taskId;
    
    // 获取选中的重复设置
    const selectedRepeats = Array.from(document.querySelectorAll('input[name="task-repeat"]:checked')).map(input => input.value);
    
    // 处理互斥逻辑：如果选择了"无"，则忽略其他选项
    let repeat_setting = '无';
    if (selectedRepeats.length > 0) {
        if (selectedRepeats.includes('无')) {
            repeat_setting = '无';
        } else {
            // 将选中的选项用逗号连接
            repeat_setting = selectedRepeats.join(',');
        }
    }
    
    const taskData = {
        user_id: appState.currentUser.id,
        name: document.getElementById('task-name').value,
        description: document.getElementById('task-description').value,
        category: document.getElementById('task-category').value,
        planned_time: parseInt(document.getElementById('task-time').value),
        points: parseInt(document.getElementById('task-points').value),
        repeat_setting: repeat_setting,
        start_date: document.getElementById('task-date').value,
        end_date: document.getElementById('task-end-date').value || null,
        status: '未完成'
    };
    
    if (!taskData.name) {
        domUtils.showToast('请输入任务名称', 'error');
        return;
    }
    
    try {
        if (isEditMode && taskId) {
            // 编辑模式
            await api.taskAPI.updateTask(taskId, taskData);
            
            // 恢复原始表单状态
            taskForm.dataset.editMode = 'false';
            taskForm.dataset.taskId = '';
            
            hideAddTaskModal();
            await loadTasks();
            await loadStatistics();
            domUtils.showToast('任务已更新');
        } else {
            // 添加模式
            const result = await api.taskAPI.addTask(taskData);
            if (result.success) {
                hideAddTaskModal();
                await loadTasks();
                domUtils.showToast('任务添加成功');
            }
        }
    } catch (error) {
        console.error(isEditMode ? '更新任务失败:' : '添加任务失败:', error);
        domUtils.showToast(isEditMode ? '更新失败，请重试' : '添加失败，请重试', 'error');
    }
}

// 显示任务菜单
function showTaskMenu(task) {
    appState.selectedTaskId = task.id;
    
    // 创建自定义菜单元素
    const menuElement = document.createElement('div');
    menuElement.className = 'task-menu-dropdown fixed z-50 bg-white shadow-lg rounded-lg p-2';
    menuElement.innerHTML = `
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded">
            <i class="fa fa-pencil text-gray-600 mr-3"></i>
            <span>编辑</span>
        </button>
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded">
            <i class="fa fa-clock-o text-yellow-500 mr-3"></i>
            <span>番茄钟</span>
        </button>
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded text-red-600">
            <i class="fa fa-trash mr-3"></i>
            <span>删除</span>
        </button>
    `;
    
    // 移除之前的菜单
    const existingMenu = document.querySelector('.task-menu-dropdown');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // 添加新菜单到文档
    document.body.appendChild(menuElement);
    
    // 设置菜单位置（基于点击的按钮）
    const event = window.event;
    if (event) {
        const rect = event.target.closest('button').getBoundingClientRect();
        menuElement.style.top = `${rect.bottom + 5}px`;
        menuElement.style.right = `${window.innerWidth - rect.right}px`;
    }
    
    // 绑定菜单事件
    menuElement.querySelector('.task-menu-item:nth-child(1)').addEventListener('click', () => {
        editTask(task);
        menuElement.remove();
    });
    
    menuElement.querySelector('.task-menu-item:nth-child(2)').addEventListener('click', () => {
        startTomatoTimer(task);
        menuElement.remove();
    });
    
    menuElement.querySelector('.task-menu-item:nth-child(3)').addEventListener('click', () => {
        deleteTask(task.id);
        menuElement.remove();
    });
    
    // 点击其他地方关闭菜单
    const handleClickOutside = (e) => {
        if (!menuElement.contains(e.target) && !e.target.closest('.task-menu')) {
            menuElement.remove();
            document.removeEventListener('click', handleClickOutside);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 0);
}

// 编辑任务
function editTask(task) {
    if (!task) {
        domUtils.showToast('未找到任务', 'error');
        return;
    }
    
    // 显示添加任务弹窗（复用现有弹窗）
    const addTaskModal = document.getElementById('add-task-modal');
    const taskForm = document.getElementById('task-form');
    const taskName = document.getElementById('task-name');
    const taskDescription = document.getElementById('task-description');
    const taskCategory = document.getElementById('task-category');
    const taskTime = document.getElementById('task-time');
    const taskPoints = document.getElementById('task-points');
    // 移除旧的taskRepeat引用，改为使用复选框组
    const taskDate = document.getElementById('task-date');
    const taskEndDate = document.getElementById('task-end-date');
    
    // 设置表单标题
    document.getElementById('modal-title').textContent = '编辑任务';
    
    // 填充表单数据
    if (taskName) taskName.value = task.name || '';
    if (taskDescription) taskDescription.value = task.description || '';
    if (taskCategory) {
        // 等待分类加载完成后设置
        setTimeout(() => {
            taskCategory.value = task.category || '';
        }, 100);
    }
    if (taskTime) taskTime.value = task.planned_time || 10;
    if (taskPoints) taskPoints.value = task.points || 1;
    // 重置所有重复设置复选框
    document.querySelectorAll('input[name="task-repeat"]').forEach(checkbox => {
        checkbox.checked = false;
        updateCheckboxStyle(checkbox);
    });
    
    // 设置重复设置复选框
    const repeatSetting = task.repeat_setting || task.repeat || '无';
    const repeats = repeatSetting.split(',');
    let hasChecked = false;
    
    repeats.forEach(repeat => {
        const checkbox = document.getElementById(`repeat-${repeat === '无' ? 'none' : 
            repeat === '每天' ? 'daily' : 
            repeat === '每个工作日' ? 'weekday' : 
            repeat === '每周一' ? 'mon' : 
            repeat === '每周二' ? 'tue' : 
            repeat === '每周三' ? 'wed' : 
            repeat === '每周四' ? 'thu' : 
            repeat === '每周五' ? 'fri' : 
            repeat === '每周六' ? 'sat' : 
            repeat === '每周日' ? 'sun' : ''}`);
        if (checkbox) {
            checkbox.checked = true;
            updateCheckboxStyle(checkbox);
            hasChecked = true;
        }
    });
    
    // 如果没有选中任何选项，默认选中"无"
    if (!hasChecked) {
        const noneCheckbox = document.getElementById('repeat-none');
        if (noneCheckbox) {
            noneCheckbox.checked = true;
            updateCheckboxStyle(noneCheckbox);
        }
    }
    if (taskDate) taskDate.value = task.start_date || task.date || new Date().toISOString().split('T')[0];
    if (taskEndDate) taskEndDate.value = task.end_date || '';
    
    // 设置编辑模式标志
    if (taskForm) {
        taskForm.dataset.editMode = 'true';
        taskForm.dataset.taskId = task.id;
    }
    
    // 显示弹窗
    if (addTaskModal) {
        addTaskModal.classList.remove('hidden');
        
        // 添加键盘事件监听，处理输入法弹出
        setTimeout(() => {
            adjustModalPosition();
        }, 100);
    }
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

// ============ 番茄钟功能（重写） ============
// 开始番茄钟 - 显示番茄钟弹窗（从 task 获取默认时间）
function startTomatoTimer(task) {
    appState.currentTask = task;
    appState.tomatoTaskId = task.id;

    const tomatoModal = document.getElementById('tomato-modal');
    const tomatoTimerElement = document.getElementById('tomato-timer');
    const tomatoTaskNameElement = document.getElementById('tomato-task-name');
    const customInput = document.getElementById('tomato-custom-minutes');

    // 默认使用任务计划时间或20分钟
    const defaultMinutes = parseInt(task.planned_time || 20, 10);

    // 更新UI
    if (tomatoTaskNameElement) tomatoTaskNameElement.textContent = `番茄钟 - ${task.name}`;
    if (customInput) customInput.value = defaultMinutes;

    // 将所有预设选项标记active
    document.querySelectorAll('.tomato-time-option').forEach(opt => {
        const m = parseInt(opt.dataset.minutes, 10);
        opt.classList.toggle('active', m === defaultMinutes);
    });

    // 初始化剩余时间（但不启动）
    appState.tomatoTimeLeft = defaultMinutes * 60;
    if (tomatoTimerElement) tomatoTimerElement.textContent = formatTime(appState.tomatoTimeLeft);
    const bubbleTimerElement = document.getElementById('bubble-timer');
    if (bubbleTimerElement) bubbleTimerElement.textContent = formatTime(appState.tomatoTimeLeft);

    // 显示 modal
    if (tomatoModal) tomatoModal.classList.remove('hidden');

    // 绑定一次性事件（安全的多次绑定保护）
    if (!appState._tomatoInit) {
        // 预设时间按钮
        document.querySelectorAll('.tomato-time-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.tomato-time-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const m = parseInt(opt.dataset.minutes, 10) || 20;
                appState.tomatoTimeLeft = m * 60;
                updateTomatoDisplays();
            });
        });

        // 自定义输入
        if (customInput) {
            customInput.addEventListener('change', () => {
                const m = Math.max(1, parseInt(customInput.value || '20', 10));
                document.querySelectorAll('.tomato-time-option').forEach(o => o.classList.remove('active'));
                appState.tomatoTimeLeft = m * 60;
                updateTomatoDisplays();
            });
        }

        // 关闭按钮
        const closeBtn = document.getElementById('tomato-close');
        if (closeBtn) closeBtn.addEventListener('click', handleTomatoClose);

        // 重置
        const resetBtn = document.getElementById('tomato-reset');
        if (resetBtn) resetBtn.addEventListener('click', handleTomatoReset);

        // 完成按钮（手动完成）
        const finishBtn = document.getElementById('tomato-finish');
        if (finishBtn) finishBtn.addEventListener('click', handleTomatoFinish);

        appState._tomatoInit = true;
    }

    // 确保悬浮球逻辑已绑定
    setupTomatoBubble();
}

// 格式化秒为 mm:ss
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTomatoDisplays() {
    const timerElement = document.getElementById('tomato-timer');
    const bubbleElement = document.getElementById('bubble-timer');
    if (timerElement) timerElement.textContent = formatTime(appState.tomatoTimeLeft);
    if (bubbleElement) bubbleElement.textContent = formatTime(appState.tomatoTimeLeft);
}

// 开始计时并收起为悬浮球
function handleTomatoStart() {
    // 如果已经在运行，忽略
    if (appState.tomatoTimer) return;

    // 从自定义输入或选项中读取时间
    const customInput = document.getElementById('tomato-custom-minutes');
    let minutes = appState.currentTask?.planned_time || 20;
    if (customInput) {
        const v = parseInt(customInput.value, 10);
        if (!isNaN(v) && v > 0) minutes = v;
    } else {
        // 若无输入，则尝试读取选中option
        const sel = document.querySelector('.tomato-time-option.active');
        if (sel) minutes = parseInt(sel.dataset.minutes, 10) || minutes;
    }

    appState.tomatoTimeLeft = minutes * 60;
    // 记录总秒数用于水位动画
    appState.tomatoTotalSeconds = minutes * 60;
    updateTomatoDisplays();

    // 开始倒计时
    appState.tomatoTimer = setInterval(() => {
        appState.tomatoTimeLeft--;
        if (appState.tomatoTimeLeft <= 0) {
            clearInterval(appState.tomatoTimer);
            appState.tomatoTimer = null;
            handleTomatoFinish();
            return;
        }
        updateTomatoDisplays();
    }, 1000);

    // 收起 modal 并强制显示悬浮球（开始后应立即可见）
    hideTomatoModal();
    const bubble = document.getElementById('tomato-bubble');
    if (bubble) {
        // 无论当前页面如何，开始后立刻显示悬浮球，页面切换时会重新评估可见性
        bubble.classList.remove('hidden');
    }

    // 启动水位动画
    startWaterFillAnimation();
}

// 关闭按钮行为：若在计时则收起为悬浮球，否则直接关闭
function handleTomatoClose() {
    if (appState.tomatoTimer) {
        hideTomatoModal();
    } else {
        const modal = document.getElementById('tomato-modal');
        if (modal) modal.classList.add('hidden');
    }
}

// 隐藏 modal，并在计时时显示悬浮球
function hideTomatoModal() {
    const modal = document.getElementById('tomato-modal');
    const bubble = document.getElementById('tomato-bubble');
    if (modal) modal.classList.add('hidden');
    if (bubble) {
        if (appState.tomatoTimer) {
            bubble.classList.remove('hidden');
        } else {
            bubble.classList.add('hidden');
        }
    }
}

// 启动/恢复悬浮球：固定在底部导航上方中间位置，点击可打开 modal
function setupTomatoBubble() {
    const bubble = document.getElementById('tomato-bubble');
    if (!bubble) return;

    // 清除旧 listener
    bubble.replaceWith(bubble.cloneNode(true));
    const newBubble = document.getElementById('tomato-bubble');

    // 固定位置样式（居中底部导航上方）
    newBubble.style.left = '50%';
    newBubble.style.transform = 'translateX(-50%)';
    newBubble.style.bottom = '70px';

    newBubble.addEventListener('click', () => {
        // 仅在计时中允许展开
        if (appState.tomatoTimer) {
            const modal = document.getElementById('tomato-modal');
            if (modal) modal.classList.remove('hidden');
            newBubble.classList.add('hidden');
        }
    });

    // 点击 modal 背景关闭并回到悬浮球（背景点击逻辑在 bindEvents 已经处理）
    // 初始化时根据当前页面和计时状态设置可见性
    ensureTomatoBubbleHidden();
}

// 根据页面和计时状态决定是否显示悬浮球
function ensureTomatoBubbleHidden() {
    const bubble = document.getElementById('tomato-bubble');
    if (!bubble) return;
    const page = document.querySelector('.nav-item-active')?.dataset?.page || 'task';
    // 在指定页面始终不显示悬浮球
    const hiddenPages = ['task', 'wish', 'profile', 'login'];
    if (hiddenPages.includes(page)) {
        bubble.classList.add('hidden');
        return;
    }
    // 只有在计时中才显示
    if (appState.tomatoTimer) bubble.classList.remove('hidden'); else bubble.classList.add('hidden');
}

// 水位动画：根据已用时间比例更新填充高度
function startWaterFillAnimation() {
    // 在悬浮球上显示水位动画
    const fillEl = document.getElementById('bubble-fill');
    if (!fillEl || !appState.currentTask) return;

    // 记录总秒数（如果尚未记录），用于比例计算
    if (!appState.tomatoTotalSeconds) {
        appState.tomatoTotalSeconds = (appState.currentTask.planned_time || 20) * 60;
    }
    const total = appState.tomatoTotalSeconds;

    // 使用 rAF 平滑更新悬浮球内的填充高度
    if (appState._waterRaf) cancelAnimationFrame(appState._waterRaf);
    const animate = () => {
        if (!fillEl) return;
        const elapsed = total - (appState.tomatoTimeLeft || 0);
        const percent = Math.max(0, Math.min(1, elapsed / total));
        // 圆形容器：用高度百分比表现水位
        fillEl.style.height = (percent * 100) + '%';
        if (appState.tomatoTimer) {
            appState._waterRaf = requestAnimationFrame(animate);
        }
    };
    appState._waterRaf = requestAnimationFrame(animate);
}

// 重置：停止计时并恢复到当前选中时间
function handleTomatoReset() {
    if (appState.tomatoTimer) {
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
    }
    // 使用自定义输入或选项恢复时间
    const customInput = document.getElementById('tomato-custom-minutes');
    let minutes = appState.currentTask?.planned_time || 20;
    if (customInput) minutes = Math.max(1, parseInt(customInput.value || '20', 10));
    appState.tomatoTimeLeft = minutes * 60;
    // 重置总秒数
    appState.tomatoTotalSeconds = minutes * 60;
    updateTomatoDisplays();
    // 隐藏悬浮球（符合在未运行时隐藏）
    ensureTomatoBubbleHidden();
}

// 完成：停止计时并标记任务完成，更新后端和界面
async function handleTomatoFinish() {
    if (appState.tomatoTimer) {
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
    }
    // 隐藏UI
    const bubble = document.getElementById('tomato-bubble');
    const modal = document.getElementById('tomato-modal');
    if (bubble) bubble.classList.add('hidden');
    if (modal) modal.classList.add('hidden');

    // 更新后端任务为已完成（使用计划时间作为实际时间）
    try {
        if (appState.tomatoTaskId) {
            const planned = appState.currentTask?.planned_time || 0;
            await api.taskAPI.updateTask(appState.tomatoTaskId, { status: '已完成', actual_time: planned, used_tomato: true });
        }
        // 刷新列表与统计
        await loadTasks();
        await loadStatistics();
        await updateUserInfo();
        domUtils.showToast('番茄钟完成，任务已标记为完成');
    } catch (err) {
        console.error('番茄钟完成时更新失败', err);
        domUtils.showToast('更新任务失败，请重试', 'error');
    }
    // 清理动画相关状态
    if (appState._waterRaf) cancelAnimationFrame(appState._waterRaf);
    appState.tomatoTotalSeconds = null;
    appState._waterRaf = null;
}

// 展示 modal（从悬浮球或其他入口）
function showTomatoModal() {
    const modal = document.getElementById('tomato-modal');
    const bubble = document.getElementById('tomato-bubble');
    if (modal) modal.classList.remove('hidden');
    if (bubble) bubble.classList.add('hidden');
}

// 加载心愿列表
async function loadWishes() {
    const wishList = document.getElementById('wish-list');
    try {
        const wishes = await api.wishAPI.getWishes(appState.currentUser.id);
        
        wishList.innerHTML = '';
        
        if (wishes.length === 0) {
            wishList.innerHTML = '<div class="col-span-2 text-center text-gray-500 py-10">暂无心愿，快去添加吧！</div>';
            return;
        }
        
        wishes.forEach(wish => {
            const wishElement = document.createElement('div');
            
            // 为不同类型的心愿选择对应的图标
            let iconSrc = '/static/images/玩游戏.png'; // 默认图标，使用绝对路径
            let bgColor = 'bg-blue-100';
            let borderColor = 'border-blue-200';
            
            // 优先使用自定义图标
            const useCustomIcon = wish.icon && wish.icon.trim() !== '' && wish.icon.startsWith('data:image');
            
            if (!useCustomIcon) {
                // 根据心愿名称选择对应图标
                const normalizedName = wish.name ? wish.name.toLowerCase() : '';
                if (normalizedName.includes('电视') || normalizedName.includes('看电视')) {
                    iconSrc = '/static/images/看电视.png';
                    bgColor = 'bg-blue-100';
                    borderColor = 'border-blue-200';
                } else if (normalizedName.includes('零花钱') || normalizedName.includes('钱')) {
                    iconSrc = '/static/images/零花钱.png';
                    bgColor = 'bg-yellow-100';
                    borderColor = 'border-yellow-200';
                } else if (normalizedName.includes('手机') || normalizedName.includes('玩手机')) {
                    iconSrc = '/static/images/玩手机.png';
                    bgColor = 'bg-gray-100';
                    borderColor = 'border-gray-200';
                } else if (normalizedName.includes('游戏') || normalizedName.includes('玩游戏')) {
                    iconSrc = '/static/images/玩游戏.png';
                    bgColor = 'bg-green-100';
                    borderColor = 'border-green-200';
                } else if (normalizedName.includes('平板') || normalizedName.includes('玩平板')) {
                    iconSrc = '/static/images/玩平板.png';
                    bgColor = 'bg-purple-100';
                    borderColor = 'border-purple-200';
                } else if (normalizedName.includes('自由') || normalizedName.includes('自由活动')) {
                    iconSrc = '/static/images/自由活动.png';
                    bgColor = 'bg-orange-100';
                    borderColor = 'border-orange-200';
                }
            } else {
                // 使用自定义图标，设置更通用的背景色
                iconSrc = wish.icon;
                bgColor = 'bg-indigo-100';
                borderColor = 'border-indigo-200';
            }
            
            wishElement.className = `bg-white rounded-2xl shadow-lg border ${borderColor} p-4 transform hover:scale-105 transition-all duration-300 mb-4 overflow-hidden relative`;
            wishElement.innerHTML = `
                <div class="absolute -right-4 -top-4 w-16 h-16 ${bgColor} rounded-full opacity-30"></div>
                <div class="flex justify-between items-start relative">
                    <div class="flex items-center">
                        <div class="w-12 h-12 ${bgColor} rounded-full flex items-center justify-center mr-3 shadow-md overflow-hidden">
                            <img src="${iconSrc}" alt="心愿图标" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-gray-800">${wish.name}</h4>
                            ${wish.exchange_amount && wish.unit ? `<p class="text-xs text-yellow-600">${wish.cost}金币可兑换${wish.exchange_amount}${wish.unit}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center">
                            <div class="flex items-center text-yellow-500 bg-yellow-50 px-3 py-1 rounded-full mr-2">
                                <i class="fa fa-coins mr-1 text-xl"></i>
                                <span class="font-bold">${wish.cost}</span>
                            </div>
                            <button class="wish-edit w-8 h-8 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors duration-200 hidden">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-gray-600 mt-3 text-sm line-clamp-2">
                        ${wish.content || wish.description || '暂无描述'}
                    </p>
                <div class="flex justify-between items-center mt-4">
                    <span class="text-xs text-gray-400">已兑换 ${wish.exchange_count || 0} 次</span>
                    <button class="wish-exchange bg-yellow-500 text-white py-1.5 px-4 rounded-lg hover:shadow-md transition-all duration-200 text-sm font-medium">
                        <i class="fa fa-gift mr-1"></i> 兑换
                    </button>
                </div>
            `;
            
            // 兑换按钮事件
            wishElement.querySelector('.wish-exchange').addEventListener('click', () => {
                handleExchangeWish(wish.id, wish.name, wish.cost);
            });
            
            // 编辑按钮事件
            const editBtn = wishElement.querySelector('.wish-edit');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    // 阻止事件冒泡，防止触发心愿卡片的点击事件
                    e.stopPropagation();
                    showEditWishModal(wish);
                });
            }
            
            // 添加心愿卡片点击事件，显示编辑按钮
            wishElement.addEventListener('click', () => {
                // 先隐藏所有其他编辑按钮
                document.querySelectorAll('.wish-edit').forEach(btn => {
                    btn.classList.add('hidden');
                });
                // 显示当前心愿的编辑按钮
                editBtn.classList.remove('hidden');
            });
            
            // 为兑换按钮添加阻止冒泡，避免点击兑换时也触发显示编辑按钮
            wishElement.querySelector('.wish-exchange').addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            wishList.appendChild(wishElement);
        });
    } catch (error) {
        console.error('加载心愿列表失败:', error);
        wishList.innerHTML = '<div class="col-span-2 text-center text-gray-500 py-10">加载失败，请稍后再试</div>';
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
                    await updateUserInfo(); // 确保所有页面的金币显示一致
                    domUtils.showToast('兑换成功！');
                }
            } catch (error) {
                domUtils.showToast('兑换失败，请重试', 'error');
            }
        }
    );
}

// 显示兑换记录相关变量
let currentHistoryPage = 1;
let totalHistoryPages = 1;
let hasMoreHistory = true;
let isLoadingHistory = false;

// 显示兑换记录
function showExchangeHistory() {
    // 重置分页状态
    currentHistoryPage = 1;
    totalHistoryPages = 1;
    hasMoreHistory = true;
    isLoadingHistory = false;
    
    // 创建并显示模态框
    const modalHTML = `
    <div id="exchange-history-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-lg w-full max-w-md max-h-[70vh] flex flex-col">
            <div class="p-3 border-b flex justify-between items-center">
                <h3 class="text-lg font-semibold">兑换记录</h3>
                <button id="close-history-modal" class="close-modal text-gray-500 hover:text-gray-700">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="overflow-y-auto flex-grow" id="history-content" style="max-height: calc(70vh - 100px);">
                <div id="history-list" class="p-2">
                    <div class="text-center py-8">加载中...</div>
                </div>
            </div>
            <div class="p-3 border-t text-center text-sm">
                <span id="pagination-info" class="text-gray-500">共 0 条记录，第 0/0 页</span>
            </div>
        </div>
    </div>`;
    
    // 移除已存在的模态框
    const existingModal = document.getElementById('exchange-history-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定关闭事件
    document.getElementById('close-history-modal').addEventListener('click', () => {
        const modal = document.getElementById('exchange-history-modal');
        if (modal) {
            modal.remove();
        }
    });
    
    // 点击模态框背景关闭
    const modal = document.getElementById('exchange-history-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // 添加滚动加载功能
    const contentArea = document.getElementById('history-content');
    contentArea.addEventListener('scroll', handleHistoryScroll);
    
    // 加载第一页数据
    loadExchangeHistory(currentHistoryPage);
}

function handleHistoryScroll() {
    const contentArea = document.getElementById('history-content');
    // 当滚动到底部附近且有更多数据且不在加载中时，加载下一页
    if (contentArea.scrollHeight - contentArea.scrollTop <= contentArea.clientHeight * 1.1 && 
        hasMoreHistory && !isLoadingHistory) {
        loadNextPage();
    }
}

function loadNextPage() {
    if (currentHistoryPage < totalHistoryPages) {
        currentHistoryPage++;
        loadExchangeHistory(currentHistoryPage);
    } else {
        hasMoreHistory = false;
    }
}

async function loadExchangeHistory(page) {
    if (isLoadingHistory || !hasMoreHistory) return;
    
    isLoadingHistory = true;
    const historyList = document.getElementById('history-list');
    
    // 添加加载提示（如果不是第一页）
    if (page > 1) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'text-center py-2 text-gray-500';
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = '加载中...';
        historyList.appendChild(loadingIndicator);
    }
    
    try {
        const response = await api.wishAPI.getExchangeHistory(appState.currentUser.id, page, 10);
        
        // 移除加载提示
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        if (response.success) {
            // 如果是第一页，清空列表
            if (page === 1) {
                historyList.innerHTML = '';
            }
            
            // 添加新记录
            if (response.data && response.data.length > 0) {
                response.data.forEach(record => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'p-3 border-b border-gray-100';
                    
                    // 格式化时间
                    const formattedTime = formatDateTime(record.operation_time);
                    
                    // 创建记录内容
                    historyItem.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-gray-600">${formattedTime}：使用${record.cost}金币可兑换了${record.exchange_info}</p>
                                <p class="font-medium mt-1">${record.wish_name}</p>
                            </div>
                            <span class="text-green-500">${record.operation_result}</span>
                        </div>
                    `;
                    
                    historyList.appendChild(historyItem);
                });
            } else if (page === 1) {
                // 没有记录时显示空状态
                historyList.innerHTML = '<div class="text-center py-10 text-gray-500">暂无兑换记录</div>';
            }
            
            // 更新分页信息
            totalHistoryPages = response.pages || 1;
            hasMoreHistory = page < totalHistoryPages;
            
            // 更新分页显示
            const paginationInfo = document.getElementById('pagination-info');
            if (paginationInfo) {
                paginationInfo.textContent = `共 ${response.total || 0} 条记录，第 ${page}/${totalHistoryPages} 页`;
            }
        } else {
            domUtils.showToast(response.message || '获取兑换记录失败', 'error');
        }
    } catch (error) {
        console.error('加载兑换记录失败:', error);
        console.log('当前用户ID:', appState.currentUser?.id);
        console.log('当前页码:', page);
        domUtils.showToast(`加载兑换记录失败: ${error.message}`, 'error');
    } finally {
        isLoadingHistory = false;
    }
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    try {
        // 解析日期时间字符串
        const date = new Date(dateTimeStr);
        
        // 检查是否是有效的日期
        if (isNaN(date.getTime())) {
            return dateTimeStr; // 如果解析失败，返回原始字符串
        }
        
        // 格式化日期时间
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}年${month}月${day}日${hours}:${minutes}`;
    } catch (error) {
        console.error('格式化日期时间失败:', error);
        return dateTimeStr; // 出错时返回原始字符串
    }
}

// 更新用户信息显示
async function updateUserInfo() {
    if (!appState.currentUser) return;
    
    try {
        // 优先使用本地存储的最新用户信息，因为API可能不再支持更新这些字段
        // 只在需要时才从API获取信息作为补充
        let user = appState.currentUser;
        
        try {
            const userInfo = await api.userAPI.getUserInfo(appState.currentUser.id);
            // 只使用API返回的用户ID、金币和头像等需要后端维护的字段，其他使用本地更新的值
            if (userInfo.user) {
                user = { ...user, id: userInfo.user.id, total_gold: userInfo.user.total_gold, avatar: userInfo.user.avatar };
                // 同步更新appState和本地存储中的头像信息
                appState.currentUser.avatar = userInfo.user.avatar;
                storageUtils.saveUser(appState.currentUser);
            }
        } catch (apiError) {
            // API调用失败不影响本地信息的更新显示
            console.log('API调用失败，使用本地用户信息');
        }
        
        // 更新我的页面信息
        if(document.getElementById('profile-username')) document.getElementById('profile-username').textContent = user.username;
        if(document.getElementById('profile-id')) document.getElementById('profile-id').textContent = `ID: ${user.id.toString().padStart(6, '0')}`;
        
        // 更新头像 - 区分默认头像和自定义上传头像
        let avatarUrl;
        if (!user.avatar || user.avatar === 'default.svg') {
            // 默认头像使用本地资源
            avatarUrl = 'static/images/avatars/default.svg';
        } else if (user.avatar.endsWith('.svg') && user.avatar.startsWith('avatar')) {
            // 预设头像使用本地资源
            avatarUrl = `static/images/avatars/${user.avatar}`;
        } else {
            // 自定义上传的头像使用API路径
            avatarUrl = `http://localhost:5000/api/avatars/${user.avatar}`;
        }
        if(document.getElementById('profile-avatar')) document.getElementById('profile-avatar').src = avatarUrl;
        if(document.getElementById('task-page-avatar')) document.getElementById('task-page-avatar').src = avatarUrl;
        
        // 更新小心愿页面标题
        if(document.getElementById('wish-page-title')) document.getElementById('wish-page-title').textContent = `「${user.username}」的心愿收集`;
        
        // 更新金币显示 - 确保所有位置金币数一致
        const goldValue = user.total_gold || 0;
        if(document.getElementById('total-gold')) document.getElementById('total-gold').textContent = goldValue;
        if(document.getElementById('total-gold-stats')) document.getElementById('total-gold-stats').textContent = goldValue;
        if(document.getElementById('wish-gold')) document.getElementById('wish-gold').textContent = goldValue;
        
    } catch (error) {
        console.error('更新用户信息失败:', error);
    }
}

// 初始化头像选择器
function initAvatarSelector() {
    const avatarSelector = document.getElementById('avatar-selector');
    if(!avatarSelector) return;
    
    const avatars = [
        'default.svg', 'avatar1.svg', 'avatar2.svg', 'avatar3.svg', 'avatar4.svg',
        'avatar5.svg', 'avatar6.svg', 'avatar7.svg', 'avatar8.svg', 'avatar9.svg'
    ];
    
    avatarSelector.innerHTML = '';
    
    // 添加自定义上传按钮
    const uploadButton = document.createElement('div');
    uploadButton.className = 'avatar-option cursor-pointer border-2 border-dashed border-gray-400 hover:border-green-500 flex flex-col items-center justify-center p-2';
    uploadButton.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        </div>
        <span class="text-xs text-gray-500">上传头像</span>
    `;
    
    // 创建隐藏的文件输入
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // 显示加载提示
                domUtils.showToast('正在上传头像...');
                
                // 调用上传API
                const result = await api.userAPI.uploadAvatar(appState.currentUser.id, file);
                
                if (result.success) {
                    // 更新隐藏字段和预览
                    const customAvatarUrl = `http://localhost:5000/api/avatars/${result.filename}`;
                    if(document.getElementById('avatar')) document.getElementById('avatar').value = result.filename;
                    if(document.getElementById('current-avatar')) document.getElementById('current-avatar').src = customAvatarUrl;
                    
                    // 更新appState中的用户头像信息
                    if (appState.currentUser) {
                        appState.currentUser.avatar = result.filename;
                        // 保存到本地存储
                        localStorage.setItem('currentUser', JSON.stringify(appState.currentUser));
                    }
                    
                    // 更新选中状态
                    document.querySelectorAll('.avatar-option').forEach(el => {
                        el.classList.remove('border-green-500');
                    });
                    uploadButton.classList.add('border-green-500');
                    
                    domUtils.showToast('头像上传成功');
                } else {
                    domUtils.showToast(result.message || '上传失败，请重试', 'error');
                }
            } catch (error) {
                console.error('上传头像失败:', error);
                domUtils.showToast('上传失败，请重试', 'error');
            }
        }
    });
    
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    avatarSelector.appendChild(uploadButton);
    avatarSelector.appendChild(fileInput);
    
    // 添加预设头像选项
    avatars.forEach(avatar => {
        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar-option cursor-pointer border-2 border-transparent hover:border-green-500';
        avatarElement.innerHTML = `<img src="static/images/avatars/${avatar}" alt="头像" class="w-12 h-12 rounded-full">`;
        avatarElement.addEventListener('click', () => {
            // 移除所有选中状态
            document.querySelectorAll('.avatar-option').forEach(el => {
                el.classList.remove('border-green-500');
            });
            // 添加当前选中状态
            avatarElement.classList.add('border-green-500');
            // 更新当前头像预览和隐藏字段
            if(document.getElementById('current-avatar')) document.getElementById('current-avatar').src = `static/images/avatars/${avatar}`;
            if(document.getElementById('avatar')) document.getElementById('avatar').value = avatar;
        });
        avatarSelector.appendChild(avatarElement);
    });
}

// 显示编辑个人信息弹窗
function showEditProfileModal() {
    // 初始化头像选择器
    initAvatarSelector();
    
    // 填充表单数据
        if (appState.currentUser) {
            if(document.getElementById('nickname')) document.getElementById('nickname').value = appState.currentUser.nickname || appState.currentUser.username || '';
            if(document.getElementById('phone')) document.getElementById('phone').value = appState.currentUser.phone || '';
            const avatar = appState.currentUser.avatar || 'default.svg';
            if(document.getElementById('avatar')) document.getElementById('avatar').value = avatar;
            // 根据头像类型选择正确的加载路径
            let avatarUrl;
            if (avatar.includes('avatar_')) {
                // 自定义上传的头像
                avatarUrl = `http://localhost:5000/api/avatars/${avatar}`;
            } else {
                // 预设头像
                avatarUrl = `static/images/avatars/${avatar}`;
            }
            if(document.getElementById('current-avatar')) document.getElementById('current-avatar').src = avatarUrl;
        }
    
    // 清空密码字段
    if(document.getElementById('current-password')) document.getElementById('current-password').value = '';
    if(document.getElementById('new-password')) document.getElementById('new-password').value = '';
    if(document.getElementById('confirm-password')) document.getElementById('confirm-password').value = '';
    
    // 显示弹窗
    if(document.getElementById('edit-profile-modal')) document.getElementById('edit-profile-modal').classList.remove('hidden');
}

// 隐藏编辑个人信息弹窗
function hideEditProfileModal() {
    if(document.getElementById('edit-profile-modal')) document.getElementById('edit-profile-modal').classList.add('hidden');
}

// 处理编辑个人信息
async function handleEditProfile(e) {
    e.preventDefault();
    
    if (!appState.currentUser) return;
    
    const nickname = document.getElementById('nickname')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const avatar = document.getElementById('avatar')?.value;
    const currentPassword = document.getElementById('current-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    
    // 验证必填字段
    if (!nickname) {
        domUtils.showToast('昵称不能为空', 'error');
        return;
    }
    
    // 如果要修改密码，需要验证
    if (newPassword || currentPassword) {
        if (!currentPassword) {
            domUtils.showToast('修改密码时需要输入当前密码', 'error');
            return;
        }
        if (!newPassword) {
            domUtils.showToast('请输入新密码', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            domUtils.showToast('两次输入的新密码不一致', 'error');
            return;
        }
    }
    
    try {
        // 构建更新数据，确保头像使用SVG格式
        let avatarValue = avatar;
        if (avatarValue && !avatarValue.endsWith('.svg')) {
            avatarValue = avatarValue.replace('.png', '.svg');
        }
        const updateData = {
            nickname: nickname,
            phone: phone,
            avatar: avatarValue
        };
        
        // 如果需要修改密码，添加密码字段
        if (newPassword) {
            updateData.current_password = currentPassword;
            updateData.new_password = newPassword;
        }
        
        // 调用API更新用户信息到服务器
        const result = await api.userAPI.updateUserInfo(appState.currentUser.id, updateData);
        if (!result.success) {
            // 显示API返回的错误信息
            domUtils.showToast(result.message || '更新失败，请重试', 'error');
            return;
        }
        
        // 更新本地存储的用户信息
        appState.currentUser.nickname = nickname;
        appState.currentUser.phone = phone;
        appState.currentUser.avatar = avatarValue;
        localStorage.setItem('currentUser', JSON.stringify(appState.currentUser));
        
        // 更新页面显示
        await updateUserInfo();
        
        // 隐藏弹窗并显示成功提示
        hideEditProfileModal();
        domUtils.showToast('个人信息更新成功');
    } catch (error) {
        console.error('更新个人信息失败:', error);
        domUtils.showToast('更新失败，请重试', 'error');
    }
}

// 显示编辑心愿弹窗
function showEditWishModal(wish) {
    // 检查弹窗是否存在，不存在则创建
    let modal = document.getElementById('edit-wish-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-wish-modal';
        modal.className = 'hidden fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto';
        modal.style.maxHeight = '100vh';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-6 w-11/12 max-w-md shadow-2xl border-2 border-yellow-100 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-end">
                    <button id="close-edit-wish" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <h3 id="edit-wish-title" class="text-2xl font-bold text-center text-gray-800 mb-6">编辑心愿</h3>
                
                <input type="hidden" id="edit-wish-id">
                <input type="hidden" id="edit-wish-icon" value="">
                
                <!-- 图标上传区域 -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-1">心愿图标</label>
                    <div class="flex flex-col items-center space-y-4">
                        <div id="wish-icon-preview" class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                            <i class="fa fa-image text-gray-400 text-4xl"></i>
                        </div>
                        <div class="w-full">
                            <label for="wish-icon-upload" class="inline-block px-4 py-2 bg-blue-500 text-white rounded-xl cursor-pointer hover:opacity-90 transition-opacity w-full text-center">
                                <i class="fa fa-upload mr-1"></i> 上传图标
                            </label>
                            <input type="file" id="wish-icon-upload" accept="image/*" class="hidden">
                            <p class="text-xs text-gray-500 mt-1 text-center">支持 PNG、JPG、GIF 格式，最大 2MB</p>
                        </div>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">心愿名称</label>
                    <input type="text" id="edit-wish-name" class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">心愿描述</label>
                    <textarea id="edit-wish-description" class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none h-20"></textarea>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">所需金币</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500">
                            <i class="fa fa-coins"></i>
                        </span>
                        <input type="number" id="edit-wish-cost" min="1" class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none">
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">单位（如：个、次、小时等）</label>
                    <input type="text" id="edit-wish-unit" class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none">
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-1">兑换数量（如：1金币兑换10分钟，则设置为10）</label>
                    <input type="number" id="edit-wish-exchange-amount" min="1" value="1" class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none">
                </div>
                
                <div class="flex justify-center gap-4">
                    <button id="delete-wish-btn" class="bg-red-50 text-red-600 py-3 px-4 rounded-xl hover:bg-red-100 transition-colors duration-200 font-bold flex-1 max-w-[120px]">
                        <i class="fa fa-trash mr-1"></i> 删除
                    </button>
                    <button id="cancel-wish-btn" class="bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-bold flex-1 max-w-[120px]">
                        <i class="fa fa-times mr-1"></i> 取消
                    </button>
                    <button id="save-wish-btn" class="bg-yellow-500 text-white py-3 px-4 rounded-xl hover:opacity-90 transition-opacity duration-200 font-bold flex-1 max-w-[120px]">
                        <i class="fa fa-save mr-1"></i> 保存
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定关闭事件
        document.getElementById('close-edit-wish').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        // 点击弹窗外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
        
        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
        
        // 绑定保存按钮事件
        document.getElementById('save-wish-btn').addEventListener('click', handleSaveWish);
        
        // 绑定删除按钮事件
        document.getElementById('delete-wish-btn').addEventListener('click', () => {
            const wishId = document.getElementById('edit-wish-id').value;
            const wishName = document.getElementById('edit-wish-name').value;
            handleDeleteWish(wishId, wishName);
        });
        
        // 绑定取消按钮事件
        document.getElementById('cancel-wish-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        // 绑定图标上传事件
        document.getElementById('wish-icon-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // 检查文件类型
                const validTypes = ['image/png', 'image/jpeg', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    domUtils.showToast('请上传PNG、JPG或GIF格式的图片', 'error');
                    return;
                }
                
                // 检查文件大小（限制为2MB）
                if (file.size > 2 * 1024 * 1024) {
                    domUtils.showToast('图片大小不能超过2MB', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('wish-icon-preview');
                    preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-contain">`;
                    document.getElementById('edit-wish-icon').value = event.target.result; // 保存为base64
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // 填充表单数据
    if (wish) {
        document.getElementById('edit-wish-id').value = wish.id;
        document.getElementById('edit-wish-name').value = wish.name;
        document.getElementById('edit-wish-description').value = wish.content || wish.description || '';
        document.getElementById('edit-wish-cost').value = wish.cost;
        document.getElementById('edit-wish-unit').value = wish.unit || '';
        document.getElementById('edit-wish-exchange-amount').value = wish.exchange_amount || 1;
        document.getElementById('edit-wish-title').textContent = '编辑心愿';
        document.getElementById('delete-wish-btn').classList.remove('hidden');
    
        // 如果有心形图标，显示在预览区域
        const iconPreview = document.getElementById('wish-icon-preview');
        const iconInput = document.getElementById('edit-wish-icon');
    
        if (wish.icon && wish.icon.trim() !== '') {
            iconPreview.innerHTML = `<img src="${wish.icon}" class="w-full h-full object-contain">`;
            iconInput.value = wish.icon;
        } else {
            // 重置为默认状态
            iconPreview.innerHTML = '<i class="fa fa-image text-gray-400 text-3xl"></i>';
            iconInput.value = '';
        }
    } else {
        // 新建心愿时清空表单
        document.getElementById('edit-wish-id').value = '';
        document.getElementById('edit-wish-name').value = '';
        document.getElementById('edit-wish-description').value = '';
        document.getElementById('edit-wish-cost').value = '';
        document.getElementById('edit-wish-unit').value = '';
        document.getElementById('edit-wish-exchange-amount').value = 1;
        document.getElementById('edit-wish-title').textContent = '新建心愿';
        document.getElementById('delete-wish-btn').classList.add('hidden');
    
        // 重置图标预览
        const iconPreview = document.getElementById('wish-icon-preview');
        const iconInput = document.getElementById('edit-wish-icon');
        iconPreview.innerHTML = '<i class="fa fa-image text-gray-400 text-3xl"></i>';
        iconInput.value = '';
    }
    
    // 显示弹窗
    modal.classList.remove('hidden');
}

// 保存心愿
async function handleSaveWish() {
    const wishId = document.getElementById('edit-wish-id').value;
    const name = document.getElementById('edit-wish-name').value.trim();
    const description = document.getElementById('edit-wish-description').value.trim();
    const cost = parseInt(document.getElementById('edit-wish-cost').value, 10);
    const unit = document.getElementById('edit-wish-unit').value.trim();
    
    // 验证输入
    if (!name) {
        domUtils.showToast('请输入心愿名称', 'error');
        return;
    }
    
    if (!cost || cost <= 0) {
        domUtils.showToast('请输入有效的所需金币数', 'error');
        return;
    }
    
    try {
        // 获取上传的图标数据
        const iconData = document.getElementById('edit-wish-icon').value;
        
        const exchangeAmount = parseInt(document.getElementById('edit-wish-exchange-amount').value, 10);
        
        // 验证兑换数量
        if (!exchangeAmount || exchangeAmount <= 0) {
            domUtils.showToast('请输入有效的兑换数量', 'error');
            return;
        }
        
        const wishData = {
            name,
            content: description,
            cost,
            unit,
            exchange_amount: exchangeAmount,
            user_id: appState.currentUser.id
        };
        
        // 如果有上传的图标，添加到数据中
        if (iconData) {
            wishData.icon = iconData;
        }
        
        let result;
        if (wishId) {
            // 更新心愿
            result = await api.wishAPI.updateWish(wishId, wishData);
        } else {
            // 新建心愿
            result = await api.wishAPI.addWish(wishData);
        }
        
        if (result.success) {
            await loadWishes();
            document.getElementById('edit-wish-modal').classList.add('hidden');
            domUtils.showToast(wishId ? '心愿更新成功' : '心愿添加成功');
        } else {
            domUtils.showToast(result.message || '操作失败，请重试', 'error');
        }
    } catch (error) {
        console.error('保存心愿失败:', error);
        domUtils.showToast('保存失败，请重试', 'error');
    }
}

// 删除心愿
async function handleDeleteWish(wishId, wishName) {
    domUtils.showConfirm(
        '确认删除',
        `确定要删除心愿「${wishName}」吗？`,
        async () => {
            try {
                const result = await api.wishAPI.deleteWish(wishId);
                if (result.success) {
                    await loadWishes();
                    document.getElementById('edit-wish-modal').classList.add('hidden');
                    domUtils.showToast('心愿删除成功');
                } else {
                    domUtils.showToast(result.message || '删除失败，请重试', 'error');
                }
            } catch (error) {
                console.error('删除心愿失败:', error);
                domUtils.showToast('删除失败，请重试', 'error');
            }
        }
    );
}

// 初始化小心愿页面
function initWishPage() {
    // 添加新建心愿按钮 - 在领取记录下方靠右
    const wishPage = document.getElementById('wish-page');
    if (wishPage) {
        // 移除旧的悬浮按钮
        const oldAddWishBtn = document.getElementById('add-wish-btn');
        if (oldAddWishBtn && oldAddWishBtn.classList.contains('fixed')) {
            oldAddWishBtn.remove();
        }
        
        // 在领取记录按钮下方添加新按钮
        let addWishBtn = document.getElementById('add-wish-btn');
        if (!addWishBtn) {
            const goldSection = document.querySelector('#wish-page .bg-gradient-to-r');
            if (goldSection) {
                // 创建一个容器来放置按钮
                const btnContainer = document.createElement('div');
                btnContainer.className = 'flex justify-end mt-4 mb-6 px-4';
                
                addWishBtn = document.createElement('button');
                addWishBtn.id = 'add-wish-btn';
                addWishBtn.className = 'bg-yellow-500 text-white py-2 px-6 rounded-full shadow-md transform transition-all duration-300 hover:shadow-lg hover:-translate-y-1';
                addWishBtn.innerHTML = '<i class="fa fa-plus mr-2"></i> 创建心愿';
                addWishBtn.addEventListener('click', () => showEditWishModal(null));
                
                btnContainer.appendChild(addWishBtn);
                goldSection.parentNode.insertBefore(btnContainer, goldSection.nextSibling);
            }
        } else {
            // 确保按钮可见
            addWishBtn.style.display = 'inline-flex';
        }
    }
}

// 处理退出登录
function handleLogout() {
    domUtils.showConfirm(
        '确认退出',
        '确定要退出登录吗？',
        () => {
            // 清除本地存储的用户信息
            storageUtils.clearUser();
            // 重置应用状态
            appState.currentUser = null;
            // 跳转到登录页面
            showLoginPage();
            domUtils.showToast('已退出登录');
        }
    );
}

// 加载荣誉列表
async function loadHonors() {
    try {
        const userHonors = await api.honorAPI.getUserHonors(appState.currentUser.id);
        const allHonors = await api.honorAPI.getAllHonors();
        
        const honorList = document.getElementById('honor-list');
        honorList.innerHTML = '';
        
        if (allHonors.length === 0) {
            honorList.innerHTML = '<div class="col-span-4 text-center text-gray-500 py-5">暂无荣誉，继续努力！</div>';
            return;
        }
        
        // 创建用户荣誉的映射
        const userHonorMap = {};
        userHonors.forEach(honor => {
            userHonorMap[honor.id] = honor;
        });
        
        // 显示所有荣誉
        allHonors.forEach(honor => {
            const isObtained = userHonorMap[honor.id] !== undefined;
            
            // 为不同类型的荣誉选择不同的背景色
            let bgColor = 'bg-yellow-100';
            let iconColor = 'text-yellow-500';
            
            if (honor.name.includes('连续')) {
                bgColor = 'bg-blue-100';
                iconColor = 'text-blue-500';
            } else if (honor.name.includes('第一个')) {
                bgColor = 'bg-pink-100';
                iconColor = 'text-pink-500';
            } else if (honor.name.includes('学习')) {
                bgColor = 'bg-green-100';
                iconColor = 'text-green-500';
            }
            
            const honorElement = document.createElement('div');
            honorElement.className = 'flex flex-col items-center p-2 transform hover:scale-110 transition-all duration-300';
            honorElement.innerHTML = `
                <div class="w-16 h-16 ${isObtained ? bgColor : 'bg-gray-100'} rounded-full flex items-center justify-center mb-2 shadow-md relative overflow-hidden">
                    <i class="fa ${honor.icon || 'fa-trophy'} ${isObtained ? iconColor : 'text-gray-400'} text-xl"></i>
                    <div class="absolute inset-0 bg-white opacity-20 rounded-full"></div>
                </div>
                <span class="text-sm font-medium text-gray-700">${honor.name}</span>
                ${isObtained ? `<span class="text-xs ${iconColor}">x${userHonorMap[honor.id].obtained_count}</span>` : ''}
            `;
            honorList.appendChild(honorElement);
        });
    } catch (error) {
        console.error('加载荣誉列表失败:', error);
        honorList.innerHTML = '<div class="col-span-4 text-center text-gray-500 py-5">加载失败，请稍后再试</div>';
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