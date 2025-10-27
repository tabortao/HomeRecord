import * as api from './api.js';
import { domUtils } from './utils.js';

class SubaccountManager {
    constructor() {
        this.subaccountModal = document.getElementById('subaccount-management-modal');
        this.editSubaccountModal = document.getElementById('edit-subaccount-modal');
        this.currentAvatar = null;
        this.editCurrentAvatar = null;
        this.currentEditingSubaccountId = null;
        this.bindEvents();
    }

    bindEvents() {
        // 绑定子账号管理按钮点击事件
        const subaccountBtn = document.getElementById('subaccount-management');
        if (subaccountBtn) {
            subaccountBtn.addEventListener('click', () => this.showModal());
        }

        // 绑定关闭按钮点击事件
        const closeBtn = document.getElementById('close-subaccount-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }
        
        // 绑定修改子账号模态窗口相关事件
        this.bindEditSubaccountEvents();
        
        // 绑定窗口大小变化事件
        this.bindResizeEvent();

        // 点击模态窗口外部关闭
        if (this.subaccountModal) {
            this.subaccountModal.addEventListener('click', (e) => {
                if (e.target === this.subaccountModal) {
                    this.hideModal();
                }
            });
        }

        // 绑定头像选择事件
        const selectAvatarBtn = document.getElementById('subaccount-select-avatar');
        const avatarInput = document.getElementById('subaccount-avatar-input');
        if (selectAvatarBtn && avatarInput) {
            selectAvatarBtn.addEventListener('click', () => avatarInput.click());
            avatarInput.addEventListener('change', (e) => this.handleAvatarSelection(e));
        }

        // 绑定创建子账号按钮点击事件
        const createBtn = document.getElementById('create-subaccount-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createSubaccount());
        }

        // 绑定用户名输入验证
        const usernameInput = document.getElementById('subaccount-username');
        if (usernameInput) {
            usernameInput.addEventListener('input', async () => {
                const errorEl = document.getElementById('subaccount-username-error');
                const passwordErrorEl = document.getElementById('subaccount-password-error');
                if (errorEl) errorEl.classList.add('hidden');
                if (passwordErrorEl) passwordErrorEl.classList.add('hidden');
                
                // 实时验证用户名格式
                const username = usernameInput.value.trim();
                if (username.length > 0) {
                    if (!/^[a-zA-Z0-9]{5,}$/.test(username)) {
                        if (errorEl) {
                            errorEl.textContent = '用户名必须为字母和数字，且长度不少于5个字符';
                            errorEl.classList.remove('hidden');
                        }
                    } else {
                        // 实时检查用户名是否可用（延迟请求，避免频繁调用API）
                        if (this.usernameCheckTimeout) clearTimeout(this.usernameCheckTimeout);
                        this.usernameCheckTimeout = setTimeout(async () => {
                            try {
                                const result = await api.subaccountAPI.checkUsernameAvailable(username);
                                if (!result.available && errorEl) {
                                    errorEl.textContent = result.message || '用户名已存在，请更换';
                                    errorEl.classList.remove('hidden');
                                }
                            } catch (error) {
                                console.error('检查用户名失败:', error);
                            }
                        }, 500);
                    }
                }
            });
        }
        
        // 绑定密码输入验证
        const passwordInput = document.getElementById('subaccount-password');
        const passwordConfirmInput = document.getElementById('subaccount-password-confirm');
        if (passwordInput && passwordConfirmInput) {
            const validatePasswords = () => {
                const password = passwordInput.value;
                const passwordConfirm = passwordConfirmInput.value;
                const passwordErrorEl = document.getElementById('subaccount-password-error');
                
                if (password && passwordConfirm && password !== passwordConfirm) {
                    if (passwordErrorEl) {
                        passwordErrorEl.classList.remove('hidden');
                    }
                } else if (passwordErrorEl) {
                    passwordErrorEl.classList.add('hidden');
                }
            };
            
            passwordInput.addEventListener('input', validatePasswords);
            passwordConfirmInput.addEventListener('input', validatePasswords);
        }
    }

    showModal() {
        if (this.subaccountModal) {
            this.subaccountModal.classList.remove('hidden');
            // 强制重排以确保正确计算高度
            this.subaccountModal.offsetHeight; // 触发重排
            // 调整模态窗口位置
            this.adjustModalPosition();
            // 加载子账号列表
            this.loadSubaccounts();
            
            // 强制内容区域可滚动
            const modalContent = this.subaccountModal.querySelector('.p-6.flex.flex-col.flex-grow.overflow-y-auto');
            if (modalContent) {
                modalContent.style.overflowY = 'auto';
            }
        }
    }

    hideModal() {
        if (this.subaccountModal) {
            this.subaccountModal.classList.add('hidden');
            // 重置表单
            this.resetForm();
        }
    }

    adjustModalPosition() {
        // 获取内容区域元素
        const modalContent = this.subaccountModal.querySelector('.p-6.flex.flex-col.flex-grow.overflow-y-auto');
        const modalContainer = this.subaccountModal.querySelector('.bg-white.rounded-2xl');
        
        if (modalContent) {
            // 重置滚动位置
            modalContent.scrollTop = 0;
            
            // 动态计算内容区域的最大高度，确保适应窗口大小
            const headerHeight = 70; // 头部高度估计值
            const padding = 24; // 内边距
            
            // 获取视口高度并减去安全边距
            const viewportHeight = Math.min(window.innerHeight, document.documentElement.clientHeight);
            const maxHeight = viewportHeight * 0.9 - headerHeight - padding;
            
            modalContent.style.maxHeight = `${maxHeight}px`;
        }
    }
    
    // 窗口大小变化时重新调整模态窗口位置
    bindResizeEvent() {
        window.addEventListener('resize', () => {
            if (this.subaccountModal && !this.subaccountModal.classList.contains('hidden')) {
                this.adjustModalPosition();
            }
        });
    }

    handleAvatarSelection(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('subaccount-avatar-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="头像预览" class="w-full h-full object-cover">`;
                }
                this.currentAvatar = file;
            };
            reader.readAsDataURL(file);
        }
    }

    async createSubaccount() {
        try {
            const nickname = document.getElementById('subaccount-nickname').value.trim();
            const username = document.getElementById('subaccount-username').value.trim();
            const password = document.getElementById('subaccount-password').value;
            const passwordConfirm = document.getElementById('subaccount-password-confirm').value;
            const permission = document.querySelector('input[name="subaccount-permission"]:checked').value;
            
            const usernameErrorEl = document.getElementById('subaccount-username-error');
            const passwordErrorEl = document.getElementById('subaccount-password-error');

            // 验证必填字段
            if (!username || !password || !passwordConfirm) {
                domUtils.showToast('用户名、密码和确认密码为必填项', 'error');
                return;
            }

            // 验证用户名格式
            if (!/^[a-zA-Z0-9]{5,}$/.test(username)) {
                if (usernameErrorEl) {
                    usernameErrorEl.textContent = '用户名必须为字母和数字，且长度不少于5个字符';
                    usernameErrorEl.classList.remove('hidden');
                }
                return;
            }

            // 验证密码一致性
            if (password !== passwordConfirm) {
                if (passwordErrorEl) {
                    passwordErrorEl.classList.remove('hidden');
                }
                return;
            }

            // 检查用户名是否已存在
            const usernameExists = await this.checkUsernameExists(username);
            if (usernameExists) {
                if (usernameErrorEl) {
                    usernameErrorEl.textContent = '用户名已存在，请更换';
                    usernameErrorEl.classList.remove('hidden');
                }
                return;
            }

            // 获取当前用户ID（默认使用1用于测试）
            const currentUserId = 1;
            
            // 构建子账号数据（不含头像）
            const subaccountData = {
                nickname,
                username,
                password,
                password_confirm: passwordConfirm,
                permission,
                parent_id: currentUserId
            };

            // 先创建子账号获取子账号ID
            const createResult = await api.subaccountAPI.createSubaccount(currentUserId, subaccountData);
            
            if (!createResult.success) {
                // 显示具体错误信息
                if (createResult.message.includes('密码不一致')) {
                    if (passwordErrorEl) {
                        passwordErrorEl.classList.remove('hidden');
                    }
                } else if (createResult.message.includes('用户名')) {
                    if (usernameErrorEl) {
                        usernameErrorEl.textContent = createResult.message;
                        usernameErrorEl.classList.remove('hidden');
                    }
                } else {
                    domUtils.showToast('子账号创建失败: ' + createResult.message, 'error');
                }
                return;
            }
            
            // 获取新创建的子账号ID
            const subaccountId = createResult.subaccount.id;
            
            // 如果有头像文件，使用子账号ID上传头像
            if (this.currentAvatar) {
                try {
                    // 使用子账号ID上传头像
                    const avatarResult = await api.userAPI.uploadAvatar(subaccountId, this.currentAvatar);
                    
                    // 更新子账号的头像信息
                    await api.userAPI.updateUserInfo(subaccountId, {
                        avatar: avatarResult.filename
                    });
                    
                } catch (avatarError) {
                    console.error('上传头像失败:', avatarError);
                    domUtils.showToast('子账号创建成功，但头像上传失败，请稍后编辑', 'warning');
                    // 继续执行，因为子账号已经创建成功
                }
            }
            
            // 子账号已创建成功
            domUtils.showToast('子账号创建成功', 'success');
            this.resetForm();
            this.loadSubaccounts();
        } catch (error) {
            console.error('创建子账号失败:', error);
            domUtils.showToast('创建子账号失败，请重试', 'error');
        }
    }

    async checkUsernameExists(username) {
        try {
            // 使用正确的API路径
            const result = await api.subaccountAPI.checkUsernameAvailable(username);
            return !result.available; // available为true表示用户名可用，不存在
        } catch (error) {
            console.error('检查用户名失败:', error);
            return false;
        }
    }

    async loadSubaccounts() {
        try {
            const currentUserId = api.userAPI.getCurrentUserId ? api.userAPI.getCurrentUserId() : 1; // 默认使用1
            const result = await api.subaccountAPI.getSubaccounts(currentUserId);
            const subaccountListEl = document.getElementById('subaccount-list');
            
            if (!subaccountListEl) return;

            if (result.subaccounts && result.subaccounts.length > 0) {
                let html = '';
                result.subaccounts.forEach(subaccount => {
                    // 使用正确的头像路径格式，直接使用api.js中定义的方式获取头像
                    const avatarUrl = subaccount.avatar ? 
                        `http://localhost:5000/api/avatars/${subaccount.avatar}` : 
                        'static/images/avatars/default.svg';
                    
                    html += `
                        <div class="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-12 h-12 rounded-full overflow-hidden mr-4">
                                    <img src="${avatarUrl}" alt="${subaccount.nickname}" class="w-full h-full object-cover" onError="this.onerror=null;this.src='static/images/avatars/default.svg';">
                                </div>
                                <div>
                                    <div class="font-medium">${subaccount.nickname || subaccount.username}</div>
                                    <div class="text-sm text-gray-500">${subaccount.username}</div>
                                    <div class="text-xs text-green-600 mt-1">权限: ${subaccount.permissions === 'view' ? '仅查看' : '可编辑'}</div>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button class="edit-subaccount-btn px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors" data-id="${subaccount.id}">
                                    修改
                                </button>
                                <button class="delete-subaccount-btn px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" data-id="${subaccount.id}">
                                    删除
                                </button>
                            </div>
                        </div>
                    `;
                });
                subaccountListEl.innerHTML = html;
                
                // 绑定删除按钮事件
                this.bindDeleteEvents();
            } else {
                subaccountListEl.innerHTML = `
                    <div class="text-center text-gray-500 py-6">
                        暂无子账号
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载子账号列表失败:', error);
            domUtils.showToast('加载子账号列表失败', 'error');
        }
    }

    bindDeleteEvents() {
        // 绑定修改按钮事件
        document.querySelectorAll('.edit-subaccount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subaccountId = e.currentTarget.getAttribute('data-id');
                this.openEditSubaccountModal(subaccountId);
            });
        });
        
        // 绑定删除按钮事件
        document.querySelectorAll('.delete-subaccount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subaccountId = e.currentTarget.getAttribute('data-id');
                this.deleteSubaccount(subaccountId);
            });
        });
    }

    async deleteSubaccount(subaccountId) {
        domUtils.showConfirm(
            '确认删除',
            '确定要删除这个子账号吗？删除后无法恢复。',
            async () => {
                try {
                    const currentUserId = api.userAPI.getCurrentUserId ? api.userAPI.getCurrentUserId() : 1; // 默认使用1
                    const result = await api.subaccountAPI.deleteSubaccount(currentUserId, subaccountId);
                    if (result.success) {
                        domUtils.showToast('子账号删除成功', 'success');
                        this.loadSubaccounts();
                    } else {
                        domUtils.showToast('删除失败: ' + result.message, 'error');
                    }
                } catch (error) {
                    console.error('删除子账号失败:', error);
                    domUtils.showToast('删除子账号失败，请重试', 'error');
                }
            },
            () => {
                // 用户取消删除，无需操作
            }
        );
    }
    
    // 绑定修改子账号模态窗口相关事件
    bindEditSubaccountEvents() {
        // 绑定关闭按钮点击事件
        const closeBtn = document.getElementById('close-edit-subaccount-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideEditModal());
        }
        
        // 绑定取消按钮点击事件
        const cancelBtn = document.getElementById('cancel-edit-subaccount');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideEditModal());
        }
        
        // 绑定保存按钮点击事件
        const saveBtn = document.getElementById('save-edit-subaccount');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSubaccountChanges());
        }
        
        // 绑定头像选择事件
        const selectAvatarBtn = document.getElementById('edit-subaccount-select-avatar');
        const avatarInput = document.getElementById('edit-subaccount-avatar-input');
        if (selectAvatarBtn && avatarInput) {
            selectAvatarBtn.addEventListener('click', () => avatarInput.click());
            avatarInput.addEventListener('change', (e) => this.handleEditAvatarSelection(e));
        }
        
        // 点击模态窗口外部关闭
        if (this.editSubaccountModal) {
            this.editSubaccountModal.addEventListener('click', (e) => {
                if (e.target === this.editSubaccountModal) {
                    this.hideEditModal();
                }
            });
        }
    }
    
    // 打开修改子账号模态窗口
    openEditSubaccountModal(subaccountId) {
        this.currentEditingSubaccountId = subaccountId;
        // 显示模态窗口
        this.editSubaccountModal.classList.remove('hidden');
        
        // 加载子账号信息
        this.loadSubaccountInfo(subaccountId);
    }
    
    // 隐藏修改子账号模态窗口
    hideEditModal() {
        // 隐藏模态窗口
        this.editSubaccountModal.classList.add('hidden');
        // 重置当前编辑的子账号ID和头像
        this.currentEditingSubaccountId = null;
        this.editCurrentAvatar = null;
    }
    
    // 处理修改子账号头像选择
    handleEditAvatarSelection(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('edit-subaccount-avatar-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="头像预览" class="w-full h-full object-cover">`;
                }
                this.editCurrentAvatar = file;
            };
            reader.readAsDataURL(file);
        }
    }
    
    // 加载子账号信息
    async loadSubaccountInfo(subaccountId) {
        try {
            // 获取子账号详细信息
            const result = await api.userAPI.getUserInfo(subaccountId);
            if (result.success) {
                const userInfo = result.user;
                
                // 填充表单数据
                document.getElementById('edit-subaccount-id').value = subaccountId;
                document.getElementById('edit-subaccount-nickname').value = userInfo.nickname || '';
                
                // 设置权限单选按钮
                document.querySelector(`input[name="edit-subaccount-permission"][value="${userInfo.permissions || 'view'}"]`).checked = true;
                
                // 设置头像预览
                const avatarUrl = userInfo.avatar ? 
                    `http://localhost:5000/api/avatars/${userInfo.avatar}` : 
                    'static/images/avatars/default.svg';
                const avatarPreview = document.getElementById('edit-subaccount-avatar-preview');
                if (avatarPreview) {
                    avatarPreview.innerHTML = `<img src="${avatarUrl}" alt="${userInfo.nickname || userInfo.username}" class="w-full h-full object-cover" onError="this.onerror=null;this.src='static/images/avatars/default.svg';">`;
                }
            }
        } catch (error) {
            console.error('加载子账号信息失败:', error);
            domUtils.showToast('加载子账号信息失败', 'error');
        }
    }
    
    // 保存子账号修改
    async saveSubaccountChanges() {
        try {
            const subaccountId = this.currentEditingSubaccountId;
            const nickname = document.getElementById('edit-subaccount-nickname').value.trim();
            const permission = document.querySelector('input[name="edit-subaccount-permission"]:checked').value;
            
            // 验证必填字段
            if (!nickname) {
                domUtils.showToast('昵称不能为空', 'error');
                return;
            }
            
            // 构建更新数据
            const updateData = {
                nickname,
                permissions: permission
            };
            
            // 更新子账号基本信息
            const updateResult = await api.userAPI.updateUserInfo(subaccountId, updateData);
            
            if (!updateResult.success) {
                domUtils.showToast('更新失败: ' + updateResult.message, 'error');
                return;
            }
            
            // 如果有新的头像文件，上传头像
            if (this.editCurrentAvatar) {
                try {
                    // 上传头像
                    const avatarResult = await api.userAPI.uploadAvatar(subaccountId, this.editCurrentAvatar);
                    
                    // 更新头像路径
                    await api.userAPI.updateUserInfo(subaccountId, {
                        avatar: avatarResult.filename
                    });
                } catch (avatarError) {
                    console.error('上传头像失败:', avatarError);
                    domUtils.showToast('基本信息更新成功，但头像上传失败', 'warning');
                }
            }
            
            // 显示成功提示
            domUtils.showToast('子账号信息更新成功', 'success');
            
            // 关闭模态窗口
            this.hideEditModal();
            
            // 重新加载子账号列表
            this.loadSubaccounts();
        } catch (error) {
            console.error('保存子账号修改失败:', error);
            domUtils.showToast('保存修改失败，请重试', 'error');
        }
    }

    resetForm() {
        document.getElementById('subaccount-nickname').value = '';
        document.getElementById('subaccount-username').value = '';
        document.getElementById('subaccount-password').value = '';
        document.getElementById('subaccount-password-confirm').value = '';
        document.getElementById('subaccount-avatar-input').value = '';
        document.querySelector('input[name="subaccount-permission"][value="view"]').checked = true;
        
        const avatarPreview = document.getElementById('subaccount-avatar-preview');
        if (avatarPreview) {
            avatarPreview.innerHTML = '<i class="fa fa-user text-gray-400 text-2xl"></i>';
        }
        
        const usernameErrorEl = document.getElementById('subaccount-username-error');
        const passwordErrorEl = document.getElementById('subaccount-password-error');
        if (usernameErrorEl) usernameErrorEl.classList.add('hidden');
        if (passwordErrorEl) passwordErrorEl.classList.add('hidden');
        
        this.currentAvatar = null;
        // 清除超时计时器
        if (this.usernameCheckTimeout) {
            clearTimeout(this.usernameCheckTimeout);
            this.usernameCheckTimeout = null;
        }
    }
}

// 初始化子账号管理器
document.addEventListener('DOMContentLoaded', () => {
    // 移除登录检查，直接初始化
    window.subaccountManager = new SubaccountManager();
});

export default SubaccountManager;