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
    } else {
        document.getElementById('add-task-btn').style.display = 'none';
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
        // 如果是标记为已完成，且没有使用番茄钟，则使用计划时间作为实际时间
        if (newStatus === '已完成') {
            // 先获取任务信息
            const tasks = await api.taskAPI.getTasks(appState.currentUser.id, appState.currentDate, '');
            const task = tasks.find(t => t.id === taskId);
            
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
    // 设置默认日期为当前选中的日期
    document.getElementById('task-date').value = appState.currentDate;
    // 清空表单
    document.getElementById('task-form').reset();
    document.getElementById('task-date').value = appState.currentDate;
    document.getElementById('task-time').value = 10;
    document.getElementById('task-points').value = 1;
    
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
    const taskRepeat = document.getElementById('task-repeat');
    const taskDate = document.getElementById('task-date');
    
    // 设置表单标题
    const modalTitle = addTaskModal?.querySelector('h3');
    if (modalTitle) {
        modalTitle.textContent = '编辑任务';
    }
    
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
    if (taskRepeat) taskRepeat.value = task.repeat || '无';
    if (taskDate) taskDate.value = task.date || dateUtils.getCurrentDate();
    
    // 保存原始提交事件
    const originalSubmitHandler = taskForm ? taskForm.onsubmit : null;
    
    // 添加编辑模式标志
    taskForm.dataset.editMode = 'true';
    taskForm.dataset.taskId = task.id;
    
    // 重写提交事件
    if (taskForm) {
        taskForm.onsubmit = async (e) => {
            e.preventDefault();
            
            try {
                // 收集表单数据
                const updatedTask = {
                    name: taskName.value,
                    description: taskDescription.value,
                    category: taskCategory.value,
                    planned_time: parseInt(taskTime.value),
                    points: parseInt(taskPoints.value),
                    repeat: taskRepeat.value,
                    date: taskDate.value
                };
                
                // 调用API更新任务
                await api.taskAPI.updateTask(task.id, updatedTask);
                
                // 恢复原始表单状态
                taskForm.dataset.editMode = 'false';
                taskForm.dataset.taskId = '';
                if (originalSubmitHandler) {
                    taskForm.onsubmit = originalSubmitHandler;
                }
                
                // 重置表单
                taskForm.reset();
                
                // 关闭弹窗
                if (typeof hideAddTaskModal === 'function') {
                    hideAddTaskModal();
                }
                
                // 重新加载任务和统计数据
                await loadTasks();
                await loadStatistics();
                
                domUtils.showToast('任务已更新');
            } catch (error) {
                console.error('更新任务失败:', error);
                domUtils.showToast('编辑任务失败，请重试', 'error');
            }
        };
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

// 开始番茄钟 - 显示番茄钟弹窗
function startTomatoTimer(task) {
    appState.currentTask = task;
    appState.tomatoTaskId = task.id;
    appState.tomatoTimeLeft = task.planned_time * 60; // 转换为秒
    
    // 显示番茄钟弹窗
    const tomatoModal = document.getElementById('tomato-modal');
    if (tomatoModal) {
        tomatoModal.classList.remove('hidden');
    }
    
    // 更新番茄钟显示
    const tomatoTimerElement = document.getElementById('tomato-timer');
    const tomatoTaskNameElement = document.getElementById('tomato-task-name');
    
    if (tomatoTaskNameElement) {
        tomatoTaskNameElement.textContent = `番茄钟 - ${task.name}`;
    }
    
    // 设置计时器显示为计划时长
    if (tomatoTimerElement) {
        tomatoTimerElement.textContent = `00:${task.planned_time}`;
    }
    
    // 添加事件监听器 - 只添加一次
    if (!appState.tomatoEventListenersAdded) {
        // 关闭番茄钟
        const tomatoClose = document.getElementById('tomato-close');
        if (tomatoClose) {
            tomatoClose.addEventListener('click', () => {
                if (tomatoModal) {
                    tomatoModal.classList.add('hidden');
                }
            });
        }
        
        // 重置番茄钟
        const tomatoReset = document.getElementById('tomato-reset');
        if (tomatoReset) {
            tomatoReset.addEventListener('click', () => {
                if (tomatoTimerElement) {
                    tomatoTimerElement.textContent = `00:${task.planned_time}`;
                }
                appState.tomatoTimeLeft = task.planned_time * 60;
            });
        }
        
        // 完成番茄钟
        const tomatoFinish = document.getElementById('tomato-finish');
        if (tomatoFinish) {
            tomatoFinish.addEventListener('click', async () => {
                // 更新任务实际时间
                try {
                    await api.updateTask(task.id, { actual_time: task.planned_time });
                    // 更新任务状态为已完成
                    await toggleTaskStatus(task.id, '进行中');
                    // 关闭番茄钟
                    if (tomatoModal) {
                        tomatoModal.classList.add('hidden');
                    }
                    // 重新加载任务和统计数据
                    loadTasks();
                    loadStatistics();
                } catch (error) {
                    console.error('更新任务时间失败:', error);
                    alert('完成番茄钟失败，请重试');
                }
            });
        }
        
        appState.tomatoEventListenersAdded = true;
    }
    
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
    
    // 保持弹窗显示，不再切换到悬浮球
    // hideTomatoModal();
}

// 处理番茄钟关闭
function handleTomatoClose() {
    // 无论是否正在倒计时，都直接关闭弹窗
    document.getElementById('tomato-modal').classList.add('hidden');
}

// 隐藏番茄钟弹窗（不再显示悬浮球）
function hideTomatoModal() {
    document.getElementById('tomato-modal').classList.add('hidden');
    // 移除显示悬浮球的代码，确保悬浮球永远隐藏
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
    
    // 隐藏悬浮球和弹窗
    document.getElementById('tomato-bubble').classList.add('hidden');
    document.getElementById('tomato-modal').classList.add('hidden');
    
    // 更新任务状态为已完成
    if (appState.tomatoTaskId) {
        try {
            // 计算实际完成时间（剩余时间转换为已用时间）
            const plannedMinutes = appState.currentTask?.planned_time || 10;
            const actualMinutes = plannedMinutes - Math.floor(appState.tomatoTimeLeft / 60);
            
            await api.taskAPI.updateTask(appState.tomatoTaskId, {
                status: '已完成',
                actual_time: actualMinutes,
                used_tomato: true // 标记使用了番茄钟
            });
            
            // 重新加载数据
            await loadTasks();
            await loadStatistics();
            await updateUserInfo(); // 确保金币数据一致性
            
            domUtils.showToast('任务完成！获得金币奖励');
        } catch (error) {
            domUtils.showToast('更新任务失败，请重试', 'error');
        }
    }
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
        
        if (wishes.length === 0) {
            wishList.innerHTML = '<div class="col-span-2 text-center text-gray-500 py-10">暂无心愿，快去添加吧！</div>';
            return;
        }
        
        wishes.forEach(wish => {
            const wishElement = document.createElement('div');
            
            // 为不同类型的心愿选择不同的图标和背景色
            let iconClass = 'fa-gift';
            let bgColor = 'bg-pink-100';
            
            if (wish.name.includes('学习')) {
                iconClass = 'fa-book';
                bgColor = 'bg-blue-100';
            } else if (wish.name.includes('玩具')) {
                iconClass = 'fa-gamepad';
                bgColor = 'bg-green-100';
            } else if (wish.name.includes('零食')) {
                iconClass = 'fa-ice-cream';
                bgColor = 'bg-yellow-100';
            }
            
            wishElement.className = 'bg-white rounded-xl shadow-md p-4 border border-gray-100 transform hover:scale-105 transition-transform duration-200 mb-4';
            wishElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center">
                        <div class="w-10 h-10 ${bgColor} rounded-full flex items-center justify-center mr-3">
                            <i class="fa ${iconClass} text-gray-700"></i>
                        </div>
                        <h4 class="font-bold text-lg text-gray-800">${wish.name}</h4>
                    </div>
                    <div class="flex items-center text-yellow-500">
                        <i class="fa fa-coins mr-1 text-xl"></i>
                        <span class="font-bold">${wish.cost}</span>
                    </div>
                </div>
                <p class="text-gray-600 mt-2 text-sm">${wish.content || wish.description}</p>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-xs text-gray-400">已兑换 ${wish.exchange_count || 0} 次</span>
                    <button class="wish-exchange bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-4 rounded-lg hover:opacity-90 transition-opacity duration-200 shadow-sm">
                        <i class="fa fa-exchange-alt mr-1"></i> 立即兑换
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

// 显示兑换记录
function showExchangeHistory() {
    domUtils.showToast('兑换记录功能开发中...');
}

// 更新用户信息显示
async function updateUserInfo() {
    if (!appState.currentUser) return;
    
    try {
        // 从API获取最新的用户信息
        const userInfo = await api.userAPI.getUserInfo(appState.currentUser.id);
        const user = userInfo.user || appState.currentUser;
        
        // 更新我的页面信息
        if(document.getElementById('profile-username')) document.getElementById('profile-username').textContent = user.username;
        if(document.getElementById('profile-id')) document.getElementById('profile-id').textContent = `ID: ${user.id.toString().padStart(6, '0')}`;
        
        // 更新头像 - 使用SVG格式
        const avatarUrl = user.avatar ? 
            (user.avatar.endsWith('.svg') ? `static/images/avatars/${user.avatar}` : `static/images/avatars/${user.avatar.replace('.png', '.svg')}`) : 
            'static/images/avatars/default.svg';
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
        if(document.getElementById('nickname')) document.getElementById('nickname').value = appState.currentUser.username || '';
        if(document.getElementById('phone')) document.getElementById('phone').value = appState.currentUser.phone || '';
        const avatar = appState.currentUser.avatar || 'default.svg';
        if(document.getElementById('avatar')) document.getElementById('avatar').value = avatar;
        if(document.getElementById('current-avatar')) document.getElementById('current-avatar').src = `static/images/avatars/${avatar}`;
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
            username: nickname,
            phone: phone,
            avatar: avatarValue
        };
        
        // 如果需要修改密码，添加密码字段
        if (newPassword) {
            updateData.current_password = currentPassword;
            updateData.new_password = newPassword;
        }
        
        // 调用API更新用户信息
        await api.userAPI.updateUserInfo(appState.currentUser.id, updateData);
        
        // 更新本地存储的用户信息
        appState.currentUser.username = nickname;
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