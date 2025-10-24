// 学科设置模块
import * as api from './api.js';

class SubjectSettingsManager {
    constructor() {
        // 获取DOM元素
        this.subjectSettingsBtn = document.getElementById('subject-settings-btn');
        this.subjectSettingsModal = document.getElementById('subject-settings-modal');
        this.closeSubjectSettings = document.getElementById('close-subject-settings');
        this.subjectsList = document.getElementById('subjects-list');
        this.newSubjectName = document.getElementById('new-subject-name');
        this.newSubjectColor = document.getElementById('new-subject-color');
        this.addSubjectBtn = document.getElementById('add-subject-btn');
        
        // 初始化用户ID
        this.userId = localStorage.getItem('user_id') || '2'; // 使用与taskTabsManager相同的默认值
        
        // 初始化事件监听
        this.initEvents();
    }
    
    // 初始化事件监听
    initEvents() {
        // 打开学科设置模态窗口
        this.subjectSettingsBtn.addEventListener('click', () => this.showModal());
        
        // 关闭学科设置模态窗口
        this.closeSubjectSettings.addEventListener('click', () => this.hideModal());
        
        // 点击模态窗口外部关闭
        this.subjectSettingsModal.addEventListener('click', (e) => {
            if (e.target === this.subjectSettingsModal) {
                this.hideModal();
            }
        });
        
        // 添加新学科
        this.addSubjectBtn.addEventListener('click', () => this.addSubject());
        
        // 回车键添加学科
        this.newSubjectName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSubject();
            }
        });
    }
    
    // 显示模态窗口
    showModal() {
        this.subjectSettingsModal.classList.remove('hidden');
        this.loadSubjects();
    }
    
    // 隐藏模态窗口
    hideModal() {
        this.subjectSettingsModal.classList.add('hidden');
        // 清空输入框
        this.newSubjectName.value = '';
    }
    
    // 加载学科列表
    async loadSubjects() {
        try {
            const subjects = await api.categoryAPI.getCategories(this.userId);
            this.renderSubjects(subjects);
        } catch (error) {
            console.error('加载学科失败:', error);
            alert('加载学科失败，请重试');
        }
    }
    
    // 渲染学科列表
    renderSubjects(subjects) {
        this.subjectsList.innerHTML = '';
        
        subjects.forEach(subject => {
            const subjectItem = document.createElement('div');
            subjectItem.className = 'bg-gray-50 rounded-lg p-3 flex flex-col';
            
            // 学科头部
            const subjectHeader = document.createElement('div');
            subjectHeader.className = 'flex items-center justify-between mb-2';
            
            // 学科名称和颜色
            const nameColorContainer = document.createElement('div');
            nameColorContainer.className = 'flex items-center';
            
            // 颜色指示器
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'w-4 h-4 rounded-full mr-2';
            colorIndicator.style.backgroundColor = subject.color;
            
            // 学科名称输入框
            const subjectNameInput = document.createElement('input');
            subjectNameInput.type = 'text';
            subjectNameInput.value = subject.name;
            subjectNameInput.className = 'flex-1 px-2 py-1 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500';
            subjectNameInput.dataset.categoryId = subject.id;
            
            // 学科操作按钮
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex space-x-2';
            
            // 颜色选择按钮
            const colorBtn = document.createElement('button');
            colorBtn.className = 'p-1 text-gray-500 hover:text-gray-700';
            colorBtn.innerHTML = '<i class="fa fa-paint-brush"></i>';
            
            // 保存按钮
            const saveBtn = document.createElement('button');
            saveBtn.className = 'p-1 text-green-500 hover:text-green-700 hidden';
            saveBtn.innerHTML = '<i class="fa fa-check"></i>';
            
            // 删除按钮（仅自定义学科显示）
            let deleteBtn = null;
            if (!subject.is_builtin) {
                deleteBtn = document.createElement('button');
                deleteBtn.className = 'p-1 text-red-500 hover:text-red-700';
                deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                deleteBtn.title = '删除学科';
            }
            
            // 组装头部
            nameColorContainer.appendChild(colorIndicator);
            nameColorContainer.appendChild(subjectNameInput);
            actionsContainer.appendChild(colorBtn);
            actionsContainer.appendChild(saveBtn);
            if (deleteBtn) {
                actionsContainer.appendChild(deleteBtn);
            }
            subjectHeader.appendChild(nameColorContainer);
            subjectHeader.appendChild(actionsContainer);
            
            // 颜色选择器（默认隐藏）
            const colorPickerContainer = document.createElement('div');
            colorPickerContainer.className = 'hidden mt-2 grid grid-cols-8 gap-1';
            
            // 预定义颜色选项
            const colors = [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
                '#8b5cf6', '#ec4899', '#6b7280', '#06b6d4',
                '#14b8a6', '#f97316', '#84cc16', '#eab308',
                '#a855f7', '#eb4d4b', '#64748b', '#0ea5e9'
            ];
            
            colors.forEach(color => {
                const colorOption = document.createElement('div');
                colorOption.className = 'w-6 h-6 rounded-full cursor-pointer border border-gray-200';
                colorOption.style.backgroundColor = color;
                colorOption.dataset.color = color;
                
                // 设置选中状态
                if (color === subject.color) {
                    colorOption.classList.add('ring-2', 'ring-blue-500');
                }
                
                colorPickerContainer.appendChild(colorOption);
            });
            
            // 组装学科项
            subjectItem.appendChild(subjectHeader);
            subjectItem.appendChild(colorPickerContainer);
            
            // 添加到列表
            this.subjectsList.appendChild(subjectItem);
            
            // 内置学科标记
            if (subject.is_builtin) {
                const builtinBadge = document.createElement('span');
                builtinBadge.className = 'text-xs text-blue-500 ml-2';
                builtinBadge.textContent = '内置';
                nameColorContainer.appendChild(builtinBadge);
            }
            
            // 添加事件监听
            this.addSubjectEventListeners(subject, subjectNameInput, colorBtn, saveBtn, deleteBtn, colorPickerContainer, colorIndicator);
        });
    }
    
    // 添加学科项的事件监听
    addSubjectEventListeners(subject, nameInput, colorBtn, saveBtn, deleteBtn, colorPicker, colorIndicator) {
        // 名称输入变化时显示保存按钮
        nameInput.addEventListener('input', () => {
            saveBtn.classList.remove('hidden');
        });
        
        // 保存修改
        saveBtn.addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                this.showToast('学科名称不能为空', 'error');
                nameInput.value = subject.name;
                return;
            }
            
            try {
                await api.categoryAPI.updateCategory(subject.id, { name: newName, color: subject.color, user_id: this.userId });
                subject.name = newName;
                saveBtn.classList.add('hidden');
                
                // 通知全局更新
                if (window.taskTabsManager) {
                    window.taskTabsManager.loadCategories();
                }
                
                this.showToast('学科名称更新成功');
            } catch (error) {
                console.error('更新学科失败:', error);
                this.showToast('更新失败，请重试', 'error');
            }
        });
        
        // 打开颜色选择器
        colorBtn.addEventListener('click', () => {
            colorPicker.classList.toggle('hidden');
        });
        
        // 选择颜色
        const colorOptions = colorPicker.querySelectorAll('div[data-color]');
        colorOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const newColor = option.dataset.color;
                
                try {
                await api.categoryAPI.updateCategory(subject.id, { name: subject.name, color: newColor, user_id: this.userId });
                subject.color = newColor;
                colorIndicator.style.backgroundColor = newColor;
                
                // 更新选中状态
                colorOptions.forEach(opt => opt.classList.remove('ring-2', 'ring-blue-500'));
                option.classList.add('ring-2', 'ring-blue-500');
                
                // 通知全局更新
                if (window.taskTabsManager) {
                    window.taskTabsManager.loadCategories();
                }
                
                // 关闭颜色选择器
                colorPicker.classList.add('hidden');
            } catch (error) {
                console.error('更新颜色失败:', error);
                this.showToast('更新失败，请重试', 'error');
            }
            });
        });
        
        // 删除学科（只对非内置学科添加事件监听）
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm(`确定要删除学科"${subject.name}"吗？`)) {
                    return;
                }
                
                try {
                    await api.categoryAPI.deleteCategory(subject.id);
                    this.loadSubjects(); // 重新加载列表
                    
                    // 通知全局更新
                    if (window.taskTabsManager) {
                        window.taskTabsManager.loadCategories();
                    }
                    
                    alert('学科删除成功');
                } catch (error) {
                    console.error('删除学科失败:', error);
                    alert('删除失败，该学科可能还有任务');
                }
            });
        }
    }
    
    // 显示临时提示消息
    showToast(message, type = 'success') {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg z-50 transition-opacity duration-300 ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 显示和隐藏动画
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }
    
    // 添加新学科
    async addSubject() {
        const name = this.newSubjectName.value.trim();
        if (!name) {
            this.showToast('学科名称不能为空', 'error');
            return;
        }
        
        // 检查是否与内置学科名称重复
        try {
            const subjects = await api.categoryAPI.getCategories(this.userId);
            const isBuiltinDuplicate = subjects.some(subject => 
                subject.name === name && subject.is_builtin
            );
            
            if (isBuiltinDuplicate) {
                this.showToast('该学科为内置学科，不可添加', 'error');
                return;
            }
        } catch (error) {
            console.error('检查学科类型失败:', error);
        }
        
        const color = this.newSubjectColor.value;
        
        try {
            await api.categoryAPI.addCategory({ name, color, user_id: this.userId });
            this.newSubjectName.value = '';
            
            // 确保重新加载学科列表
            console.log('添加学科成功，重新加载列表');
            await this.loadSubjects(); // 重新加载列表
            
            // 通知全局更新
            if (window.taskTabsManager) {
                console.log('通知taskTabsManager更新分类');
                await window.taskTabsManager.loadCategories();
            }
            
            this.showToast('学科添加成功');
        } catch (error) {
            console.error('添加学科失败:', error);
            this.showToast('添加失败，学科名称可能已存在', 'error');
        }
    }
}

// 导出模块
export default SubjectSettingsManager;