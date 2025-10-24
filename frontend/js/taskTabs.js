// 导入API和工具函数
import * as api from './api.js';

// 标签页管理
class TaskTabsManager {
    constructor() {
        this.recognizedTasks = [];
        this.init();
    }

    init() {
        // 初始化标签页事件监听
        this.initTabEvents();
        // 初始化批量添加事件监听
        this.initBatchAddEvents();
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
            alert('请输入作业文本内容');
            return;
        }

        try {
            // 模拟API调用（实际应该调用后端API）
            // const result = await api.recognizeTasks(content);
            // 这里使用本地模拟数据进行识别
            this.recognizedTasks = this.mockRecognizeTasks(content);
            this.renderRecognizedTasks();
        } catch (error) {
            console.error('识别任务失败:', error);
            alert('任务识别失败，请重试');
        }
    }

    // 模拟任务识别（实际应该由后端API完成）
    mockRecognizeTasks(content) {
        const tasks = [];
        // 简单的规则匹配来识别任务
        const lines = content.split(/[；;\n]/);
        
        lines.forEach((line, index) => {
            line = line.trim();
            if (!line) return;
            
            let category = '其他';
            let name = line;
            let points = 1;
            let time = 10;
            
            // 尝试识别学科分类
            if (line.includes('语文')) {
                category = '语文';
                name = line.replace(/语文[：:]/, '').trim();
            } else if (line.includes('数学')) {
                category = '数学';
                name = line.replace(/数学[：:]/, '').trim();
            } else if (line.includes('英语')) {
                category = '英语';
                name = line.replace(/英语[：:]/, '').trim();
            } else if (line.includes('物理')) {
                category = '物理';
                name = line.replace(/物理[：:]/, '').trim();
            } else if (line.includes('化学')) {
                category = '化学';
                name = line.replace(/化学[：:]/, '').trim();
            } else if (line.includes('生物')) {
                category = '生物';
                name = line.replace(/生物[：:]/, '').trim();
            } else if (line.includes('历史')) {
                category = '历史';
                name = line.replace(/历史[：:]/, '').trim();
            } else if (line.includes('地理')) {
                category = '地理';
                name = line.replace(/地理[：:]/, '').trim();
            } else if (line.includes('政治')) {
                category = '政治';
                name = line.replace(/政治[：:]/, '').trim();
            }
            
            // 基于任务长度设置默认时间和积分
            if (name.length > 20) {
                time = 20;
                points = 2;
            } else if (name.length > 10) {
                time = 15;
                points = 1;
            }
            
            tasks.push({
                id: `temp-${index}`,
                name: name,
                category: category,
                points: points,
                time: time,
                selected: true,
                description: ''
            });
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
                            <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full mr-2">${task.category}</span>
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
    editTask(taskId) {
        const task = this.recognizedTasks.find(t => t.id === taskId);
        if (!task) return;
        
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
                            <option value="语文" ${task.category === '语文' ? 'selected' : ''}>语文</option>
                            <option value="数学" ${task.category === '数学' ? 'selected' : ''}>数学</option>
                            <option value="英语" ${task.category === '英语' ? 'selected' : ''}>英语</option>
                            <option value="物理" ${task.category === '物理' ? 'selected' : ''}>物理</option>
                            <option value="化学" ${task.category === '化学' ? 'selected' : ''}>化学</option>
                            <option value="生物" ${task.category === '生物' ? 'selected' : ''}>生物</option>
                            <option value="历史" ${task.category === '历史' ? 'selected' : ''}>历史</option>
                            <option value="地理" ${task.category === '地理' ? 'selected' : ''}>地理</option>
                            <option value="政治" ${task.category === '政治' ? 'selected' : ''}>政治</option>
                            <option value="其他" ${task.category === '其他' ? 'selected' : ''}>其他</option>
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
            alert('请选择要添加的任务');
            return;
        }

        try {
            // 获取当前日期
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            // 逐个添加任务
            for (const task of selectedTasks) {
                const taskData = {
                    name: task.name,
                    description: task.description,
                    category: task.category,
                    time: task.time,
                    points: task.points,
                    date: formattedDate,
                    repeat: '无'
                };
                
                await api.createTask(taskData);
            }
            
            // 显示成功提示
            alert(`成功添加${selectedTasks.length}个任务`);
            
            // 关闭模态窗口
            this.closeModal();
            
            // 刷新任务列表（假设app.js中有refreshTasks函数）
            if (window.refreshTasks) {
                window.refreshTasks();
            }
        } catch (error) {
            console.error('添加任务失败:', error);
            alert('添加任务失败，请重试');
        }
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