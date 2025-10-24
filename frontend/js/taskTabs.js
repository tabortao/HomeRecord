// 导入API和工具函数
import { taskAPI } from './api.js';
import { categoryAPI } from './api.js';
import { colorUtils } from './utils.js';

// 标签页管理
class TaskTabsManager {
    constructor() {
        this.recognizedTasks = [];
        this.categories = [];
        this.init();
    }

    init() {
        // 初始化标签页事件监听
        this.initTabEvents();
        // 初始化批量添加事件监听
        this.initBatchAddEvents();
        // 加载学科分类
        this.loadCategories();
    }

    // 初始化标签页切换事件
    initTabEvents() {
        const singleTab = document.getElementById('single-add-tab');
        const batchTab = document.getElementById('batch-add-tab');
        const singleContent = document.getElementById('single-add-content');
        const batchContent = document.getElementById('batch-add-content');

        if (singleTab && batchTab && singleContent && batchContent) {
            singleTab.addEventListener('click', () => {
                // 激活单个添加标签页
                singleTab.classList.add('border-indigo-500', 'text-indigo-600');
                singleTab.classList.remove('border-transparent', 'text-gray-500');
                batchTab.classList.add('border-transparent', 'text-gray-500');
                batchTab.classList.remove('border-indigo-500', 'text-indigo-600');
                
                // 显示单个添加内容，隐藏批量添加内容
                singleContent.classList.add('block');
                singleContent.classList.remove('hidden');
                batchContent.classList.add('hidden');
                batchContent.classList.remove('block');
            });

            batchTab.addEventListener('click', () => {
                // 激活批量添加标签页
                batchTab.classList.add('border-indigo-500', 'text-indigo-600');
                batchTab.classList.remove('border-transparent', 'text-gray-500');
                singleTab.classList.add('border-transparent', 'text-gray-500');
                singleTab.classList.remove('border-indigo-500', 'text-indigo-600');
                
                // 显示批量添加内容，隐藏单个添加内容
                batchContent.classList.add('block');
                batchContent.classList.remove('hidden');
                singleContent.classList.add('hidden');
                singleContent.classList.remove('block');
            });
        }
    }

    // 初始化批量添加相关事件
    initBatchAddEvents() {
        // 智能识别按钮事件
        const recognizeBtn = document.getElementById('recognize-tasks-btn');
        if (recognizeBtn) {
            recognizeBtn.addEventListener('click', () => this.recognizeTasks());
        }

        // 取消批量添加按钮事件
        const cancelBtn = document.getElementById('cancel-batch-task');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // 添加选中任务按钮事件
        const addSelectedBtn = document.getElementById('add-selected-tasks-btn');
        if (addSelectedBtn) {
            addSelectedBtn.addEventListener('click', () => this.addSelectedTasks());
        }
    }

    // 智能识别任务
    async recognizeTasks() {
        const content = document.getElementById('batch-task-content').value.trim();
        if (!content) {
            this.showNotification('请输入作业文本内容', 'warning');
            return;
        }

        try {
            // 模拟API调用（实际应该调用后端API）
            // const result = await taskAPI.recognizeTasks(content);
            // 这里使用本地模拟数据进行识别
            this.recognizedTasks = this.mockRecognizeTasks(content);
            this.renderRecognizedTasks();
        } catch (error) {
            console.error('识别任务失败:', error);
            this.showNotification('任务识别失败，请重试', 'error');
        }
    }

    // 模拟任务识别（实际应该由后端API完成）
    mockRecognizeTasks(content) {
        const tasks = [];
        const lines = content.split('\n');
        
        // 定义可能的学科列表
        const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '劳动', '生活', '兴趣', '表扬', '批评', '独立', '惩罚'];
        let currentSubject = '其他';
        let taskIndex = 0;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            // 检查是否是学科标题行
            if (subjects.includes(line)) {
                currentSubject = line;
                return; // 跳过学科标题行，不创建任务
            }
            
            // 检查是否是任务列表项（数字. 开头或数字.开头）
            const taskMatch = line.match(/^(\d+)[.。]\s*(.+)$/);
            if (taskMatch) {
                // 是任务列表项，提取任务名称
                const taskName = taskMatch[2].trim();
                let points = 1;
                let time = 10;
                
                // 基于任务长度设置默认时间和积分
                if (taskName.length > 20) {
                    time = 20;
                    points = 2;
                } else if (taskName.length > 10) {
                    time = 15;
                    points = 1;
                }
                
                tasks.push({
                    id: `temp-${taskIndex++}`,
                    name: taskName,
                    category: currentSubject,
                    points: points,
                    time: time,
                    selected: true,
                    description: ''
                });
            } else {
                // 处理其他情况，尝试匹配学科和任务
                let category = currentSubject; // 默认使用当前学科
                let name = line;
                
                // 尝试从行中提取学科
                for (const subject of subjects) {
                    if (line.includes(subject)) {
                        category = subject;
                        // 从行中移除学科名称和可能的分隔符
                        name = line.replace(`${subject}[：:、]?`.replace(/\[([^\]]+)\]/g, '$1'), '').trim();
                        break;
                    }
                }
                
                // 只有当任务名称不为空时才添加
                if (name) {
                    let points = 1;
                    let time = 10;
                    
                    if (name.length > 20) {
                        time = 20;
                        points = 2;
                    } else if (name.length > 10) {
                        time = 15;
                        points = 1;
                    }
                    
                    tasks.push({
                        id: `temp-${taskIndex++}`,
                        name: name,
                        category: category,
                        points: points,
                        time: time,
                        selected: true,
                        description: ''
                    });
                }
            }
        });
        
        return tasks;
    }

    // 渲染识别出的任务列表
    renderRecognizedTasks() {
        const resultsContainer = document.getElementById('recognition-results');
        const tasksList = document.getElementById('recognized-tasks-list');
        const addSelectedBtn = document.getElementById('add-selected-tasks-btn');
        
        if (!resultsContainer || !tasksList || !addSelectedBtn) return;
        
        // 清空现有任务列表
        tasksList.innerHTML = '';
        
        // 添加新识别的任务
        this.recognizedTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'flex items-center p-2 rounded-lg hover:bg-gray-50 border border-gray-100';
            taskElement.innerHTML = `
                <div class="flex items-center flex-1">
                    <input type="checkbox" id="task-${task.id}" class="task-checkbox mr-3" data-id="${task.id}" ${task.selected ? 'checked' : ''}>
                    <div>
                        <label for="task-${task.id}" class="text-sm font-medium text-gray-800 cursor-pointer">${task.name}</label>
                        <div class="flex items-center text-xs text-gray-500 mt-0.5">
                            <span class="px-2 py-0.5 rounded-full mr-2" style="background-color: rgba(0,0,0,0.05); color: ${colorUtils.getCategoryColor(task.category)}">${task.category}</span>
                            <span class="mr-2"><i class="fa fa-clock-o mr-1"></i>${task.time}分钟</span>
                            <span><i class="fa fa-star text-yellow-500 mr-1"></i>${task.points}分</span>
                        </div>
                    </div>
                </div>
                <button class="edit-task-btn text-blue-500 hover:text-blue-700" data-id="${task.id}">
                    <i class="fa fa-pencil"></i>
                </button>
            `;
            tasksList.appendChild(taskElement);
            
            // 添加复选框事件
            const checkbox = taskElement.querySelector('.task-checkbox');
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-id');
                const task = this.recognizedTasks.find(t => t.id === taskId);
                if (task) {
                    task.selected = e.target.checked;
                    this.updateAddButtonState();
                }
            });
            
            // 添加编辑按钮事件
            const editBtn = taskElement.querySelector('.edit-task-btn');
            editBtn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.edit-task-btn').getAttribute('data-id');
                this.editTask(taskId);
            });
            
            // 点击任务区域进入编辑
            taskElement.querySelector('div > div').addEventListener('click', (e) => {
                if (!e.target.closest('input[type="checkbox"]') && !e.target.closest('.edit-task-btn')) {
                    const taskId = taskElement.querySelector('.task-checkbox').getAttribute('data-id');
                    this.editTask(taskId);
                }
            });
        });
        
        // 显示识别结果区域
        resultsContainer.classList.remove('hidden');
        
        // 更新添加按钮状态
        this.updateAddButtonState();
    }

    // 更新添加按钮状态
    updateAddButtonState() {
        const addSelectedBtn = document.getElementById('add-selected-tasks-btn');
        if (!addSelectedBtn) return;
        
        const hasSelectedTasks = this.recognizedTasks.some(task => task.selected);
        addSelectedBtn.disabled = !hasSelectedTasks;
        
        if (hasSelectedTasks) {
            addSelectedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            addSelectedBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // 编辑任务
    async editTask(taskId) {
        const task = this.recognizedTasks.find(t => t.id === taskId);
        if (!task) return;
        
        // 确保学科分类已加载
        if (this.categories.length === 0) {
            await this.loadCategories();
        }
        
        // 使用已加载的学科分类列表
        const categories = this.categories.length > 0 ? this.categories : [
            { name: '语文' }, { name: '数学' }, { name: '英语' },
            { name: '物理' }, { name: '化学' }, { name: '生物' },
            { name: '历史' }, { name: '地理' }, { name: '政治' },
            { name: '其他' }
        ];
        
        // 创建编辑模态窗口
        const editModal = document.createElement('div');
        editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        editModal.innerHTML = `
            <div class="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                <h3 class="text-lg font-bold text-indigo-600 mb-4">编辑任务</h3>
                <form id="edit-task-form" class="space-y-4">
                    <div>
                        <label for="edit-task-name" class="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
                        <input type="text" id="edit-task-name" value="${task.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    <div>
                        <label for="edit-task-category" class="block text-sm font-medium text-gray-700 mb-1">学科分类</label>
                        <select id="edit-task-category" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            ${categories.map(cat => 
                                `<option value="${cat.name}" ${task.category === cat.name ? 'selected' : ''}>${cat.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="edit-task-time" class="block text-sm font-medium text-gray-700 mb-1">计划时长（分钟）</label>
                        <input type="number" id="edit-task-time" value="${task.time}" min="1" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    <div>
                        <label for="edit-task-points" class="block text-sm font-medium text-gray-700 mb-1">奖励金币</label>
                        <input type="number" id="edit-task-points" value="${task.points}" min="1" max="99" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    <div>
                        <label for="edit-task-description" class="block text-sm font-medium text-gray-700 mb-1">任务描述（可选）</label>
                        <textarea id="edit-task-description" rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-lg">${task.description || ''}</textarea>
                    </div>
                    <div class="flex space-x-4 pt-2">
                        <button type="button" id="cancel-edit-task" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700">取消</button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">保存</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(editModal);
        
        // 取消编辑
        document.getElementById('cancel-edit-task').addEventListener('click', () => {
            document.body.removeChild(editModal);
        });
        
        // 保存编辑
        document.getElementById('edit-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            task.name = document.getElementById('edit-task-name').value.trim();
            task.category = document.getElementById('edit-task-category').value;
            task.time = parseInt(document.getElementById('edit-task-time').value) || 10;
            task.points = parseInt(document.getElementById('edit-task-points').value) || 1;
            task.description = document.getElementById('edit-task-description').value.trim();
            
            document.body.removeChild(editModal);
            this.renderRecognizedTasks();
        });
    }

    // 添加选中的任务
    async addSelectedTasks() {
        const selectedTasks = this.recognizedTasks.filter(task => task.selected);
        if (selectedTasks.length === 0) {
            this.showNotification('请选择要添加的任务', 'warning');
            return;
        }

        try {
                console.log('开始添加选中的任务，共', selectedTasks.length, '个');
                // 获取当前日期
                const today = new Date();
                const formattedDate = today.toISOString().split('T')[0];
                console.log('当前日期:', formattedDate);
                
                // 逐个添加任务
                for (const task of selectedTasks) {
                    console.log('正在处理任务:', task.name);
                    // 从localStorage获取用户ID，如果不存在则使用测试账号ID 2
                    let userId = localStorage.getItem('user_id');
                    // 如果localStorage中没有user_id，使用默认值2（测试账号ID）
                    if (!userId) {
                        userId = '2';
                        console.log('localStorage中未找到user_id，使用默认值2');
                    }
                    console.log('用户ID:', userId);
                    
                    // 确保所有必要字段都有值
                    const taskName = task.name || '未命名任务';
                    const taskCategory = task.category || '其他';
                    const taskTime = task.time || 10;
                    const taskPoints = task.points || 1;
                    
                    const taskData = {
                        user_id: userId,
                        name: taskName,
                        description: task.description || '',
                        icon: 'default.png',
                        category: taskCategory,
                        planned_time: taskTime,
                        actual_time: 0,
                        points: taskPoints,
                        start_date: formattedDate,
                        date: formattedDate,
                        end_date: formattedDate,
                        status: '未完成',
                        repeat_setting: '无'
                    };
                    
                    console.log('准备添加任务数据:', taskData);
                    try {
                        console.log('开始调用taskAPI.addTask');
                        const response = await taskAPI.addTask(taskData);
                        console.log('任务添加成功，响应:', response);
                    } catch (error) {
                        console.error('单个任务添加失败:', error);
                        console.error('错误详情:', error.message);
                        // 继续添加其他任务，不中断整个流程
                    }
                }
            
            // 显示成功提示
            this.showNotification(`成功添加${selectedTasks.length}个任务`, 'success');
            
            // 关闭模态窗口
            this.closeModal();
            
            // 刷新任务列表
            if (window.refreshTasks) {
                console.log('调用window.refreshTasks刷新任务列表');
                window.refreshTasks();
            } else {
                console.log('window.refreshTasks不存在，使用页面重载刷新');
                // 使用setTimeout稍微延迟重载，确保用户能看到成功提示
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('添加任务失败:', error);
            this.showNotification('添加任务失败，请重试', 'error');
        }
    }
    
    // 显示非模态提示
    showNotification(message, type = 'info') {
        // 检查是否已有通知元素
        let notification = document.getElementById('custom-notification');
        
        if (!notification) {
            // 创建通知元素
            notification = document.createElement('div');
            notification.id = 'custom-notification';
            notification.className = 'fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out opacity-0 translate-y-[-20px]';
            document.body.appendChild(notification);
        }
        
        // 设置通知类型样式
        notification.className = 'fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out';
        
        if (type === 'success') {
            notification.className += ' bg-green-50 text-green-800 border-l-4 border-green-500';
        } else if (type === 'error') {
            notification.className += ' bg-red-50 text-red-800 border-l-4 border-red-500';
        } else if (type === 'warning') {
            notification.className += ' bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500';
        } else {
            notification.className += ' bg-blue-50 text-blue-800 border-l-4 border-blue-500';
        }
        
        // 设置消息内容
        notification.textContent = message;
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('opacity-100', 'translate-y-0');
        }, 10);
        
        // 自动消失
        setTimeout(() => {
            notification.classList.remove('opacity-100', 'translate-y-0');
            notification.classList.add('opacity-0', 'translate-y-[-20px]');
            
            // 动画结束后移除元素
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 关闭模态窗口
    closeModal() {
        const modal = document.getElementById('add-task-modal');
        if (modal) {
            modal.classList.add('hidden');
            
            // 重置批量添加表单
            document.getElementById('batch-task-content').value = '';
            document.getElementById('recognition-results').classList.add('hidden');
            this.recognizedTasks = [];
        }
    }
    
    // 加载学科分类列表（供SubjectSettingsManager调用）
    async loadCategories() {
        try {
            // 获取当前用户ID
            const userId = localStorage.getItem('user_id') || '2';
            
            console.log('开始加载学科分类，用户ID:', userId);
            // 从API获取学科分类
            const categories = await categoryAPI.getCategories(userId);
            this.categories = categories;
            
            console.log('成功加载学科分类:', this.categories);
            
            // 更新所有相关的UI组件
            this.updateCategoryDropdowns();
            
        } catch (error) {
            console.error('加载学科分类时出错:', error);
            // 使用默认学科列表作为后备
            this.categories = [
                { name: '语文' }, { name: '数学' }, { name: '英语' },
                { name: '物理' }, { name: '化学' }, { name: '生物' },
                { name: '历史' }, { name: '地理' }, { name: '政治' },
                { name: '其他' }
            ];
        }
    }
    
    // 更新所有学科分类下拉菜单
    updateCategoryDropdowns() {
        console.log('更新学科分类下拉菜单');
        
        // 查找并更新页面上所有的学科分类下拉菜单
        const categorySelectors = document.querySelectorAll('select[id*="category"], select[class*="category"]');
        categorySelectors.forEach(select => {
            const currentValue = select.value;
            
            // 清空现有选项（保留第一个选项，如果是"全部学科"等）
            const firstOption = select.firstElementChild;
            const hasAllOption = firstOption && (firstOption.value === '全部学科' || firstOption.textContent === '全部学科');
            
            select.innerHTML = '';
            
            // 如果原本有"全部学科"选项，重新添加
            if (hasAllOption) {
                const allOption = document.createElement('option');
                allOption.value = '全部学科';
                allOption.textContent = '全部学科';
                select.appendChild(allOption);
            }
            
            // 添加学科选项
            this.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                select.appendChild(option);
            });
            
            // 尝试保持之前选择的值
            if (currentValue) {
                const optionExists = Array.from(select.options).some(opt => opt.value === currentValue);
                if (optionExists) {
                    select.value = currentValue;
                } else if (this.categories.length > 0) {
                    select.value = this.categories[0].name;
                }
            }
        });
        
        // 特别更新编辑任务模态窗口中的学科下拉菜单
        if (document.getElementById('edit-task-category')) {
            const editCategorySelect = document.getElementById('edit-task-category');
            const currentValue = editCategorySelect.value;
            
            editCategorySelect.innerHTML = '';
            
            // 添加学科选项
            this.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                editCategorySelect.appendChild(option);
            });
            
            // 尝试保持之前选择的值
            if (currentValue) {
                const optionExists = Array.from(editCategorySelect.options).some(opt => opt.value === currentValue);
                if (optionExists) {
                    editCategorySelect.value = currentValue;
                } else if (this.categories.length > 0) {
                    editCategorySelect.value = this.categories[0].name;
                }
            }
        }
    }
}

// 导出TaskTabsManager类
export default TaskTabsManager;

// 当页面加载完成后初始化
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // 等待app.js初始化完成
        setTimeout(() => {
            window.taskTabsManager = new TaskTabsManager();
        }, 500);
    });
}