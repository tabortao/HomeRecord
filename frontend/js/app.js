// 导入API和工具函数
import * as api from './api.js';
// 定义API基础URL
const API_BASE_URL = 'http://localhost:5000/api';
import { dateUtils, timeUtils, storageUtils, domUtils, colorUtils } from './utils.js';
// 导入学科设置管理器
import SubjectSettingsManager from './subjectSettings.js';

// 安全解析JSON的辅助函数
function tryParseJSON(jsonString) {
    // 检查输入类型
    if (jsonString === null || jsonString === undefined) {
        return null;
    }
    
    // 如果已经是数组或对象，直接返回
    if (Array.isArray(jsonString) || typeof jsonString === 'object') {
        return jsonString;
    }
    
    try {
        // 尝试解析字符串
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON解析错误:', e, '输入:', jsonString, '类型:', typeof jsonString);
        // 如果输入看起来像空数组字符串，返回空数组
        if (String(jsonString).trim() === '[]') {
            return [];
        }
        return null;
    }
}

// 全局状态
let appState = {
    currentUser: null,
    currentDate: dateUtils.getCurrentDate(),
    currentCategory: '全部学科',
    selectedTaskId: null,
    tomatoTimer: null,
    tomatoTimeLeft: 0,
    tomatoTaskId: null,
    tomatoMode: 'countdown', // countdown 或 stopwatch
    tomatoElapsedSeconds: 0,
    // 番茄钟设置
    fixedTomatoPage: false,
    // 任务设置
    taskSettings: {
        autoSort: false // 任务自动排序开关
    }
};

// 全局筛选状态
let currentFilter = 'all';

// 操作记录相关变量
let currentLogsPage = 1;
let totalLogsPages = 1;
let hasMoreLogs = true;
let isLoadingLogs = false;

// 初始化任务图片上传功能
function initTaskImagesUpload() {
    const uploadContainer = document.getElementById('task-images-container');
    const fileInput = document.getElementById('task-images-upload');
    const previewContainer = document.getElementById('uploaded-images-preview');
    
    if (!uploadContainer || !fileInput || !previewContainer) return;
    
    // 点击上传区域触发文件选择
    uploadContainer.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 处理文件选择
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files);
    });
    
    // 处理拖拽上传
    uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadContainer.classList.add('border-indigo-500', 'bg-indigo-50');
    });
    
    uploadContainer.addEventListener('dragleave', () => {
        uploadContainer.classList.remove('border-indigo-500', 'bg-indigo-50');
    });
    
    uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadContainer.classList.remove('border-indigo-500', 'bg-indigo-50');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files);
        }
    });
    
    // 处理文件选择和预览
    function handleFileSelection(files) {
        previewContainer.classList.remove('hidden');
        previewContainer.innerHTML = '';
        
        Array.from(files).forEach((file, index) => {
            // 检查文件类型
            if (!file.type.match('image.*')) {
                domUtils.showToast('请选择图片文件', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewWrapper = document.createElement('div');
                previewWrapper.className = 'relative group';
                previewWrapper.dataset.index = index;
                
                const preview = document.createElement('img');
                preview.src = e.target.result;
                preview.className = 'w-full h-20 object-contain rounded-md border border-gray-200 bg-white';
                preview.alt = '图片预览';
                
                // 添加点击放大功能
                preview.addEventListener('click', () => {
                    openImageViewer([e.target.result]);
                });
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity';
                removeBtn.innerHTML = '<i class="fa fa-times text-xs"></i>';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    previewWrapper.remove();
                    
                    // 如果没有预览图片了，隐藏预览容器
                    if (previewContainer.children.length === 0) {
                        previewContainer.classList.add('hidden');
                    }
                });
                
                previewWrapper.appendChild(preview);
                previewWrapper.appendChild(removeBtn);
                previewContainer.appendChild(previewWrapper);
            };
            
            reader.readAsDataURL(file);
        });
    }
}

// 清除已上传图片预览
function clearTaskImagesPreview() {
    const previewContainer = document.getElementById('uploaded-images-preview');
    const fileInput = document.getElementById('task-images-upload');
    
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
    }
    
    if (fileInput) {
        fileInput.value = '';
    }
}

// 图片查看器相关功能
let currentImages = [];
let currentImageIndex = 0;

// 初始化图片查看器
function initImageViewer() {
    const viewerModal = document.getElementById('image-viewer-modal');
    const closeBtn = document.getElementById('close-image-viewer');
    const prevBtn = document.getElementById('prev-image-btn');
    const nextBtn = document.getElementById('next-image-btn');
    
    if (!viewerModal || !closeBtn || !prevBtn || !nextBtn) return;
    
    // 关闭图片查看器
    closeBtn.addEventListener('click', closeImageViewer);
    
    // 点击模态窗口背景关闭
    viewerModal.addEventListener('click', (e) => {
        if (e.target === viewerModal) {
            closeImageViewer();
        }
    });
    
    // 左右翻页
    prevBtn.addEventListener('click', showPreviousImage);
    nextBtn.addEventListener('click', showNextImage);
    
    // 键盘事件支持
    document.addEventListener('keydown', (e) => {
        if (!viewerModal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                closeImageViewer();
            } else if (e.key === 'ArrowLeft') {
                showPreviousImage();
            } else if (e.key === 'ArrowRight') {
                showNextImage();
            }
        }
    });
    
    // 监听任务图片图标的点击事件
    document.addEventListener('click', (e) => {
        const imageIcon = e.target.closest('.task-images-icon');
        if (imageIcon) {
            const imagesData = imageIcon.dataset.images;
            if (imagesData) {
                try {
                    const images = JSON.parse(imagesData);
                    openImageViewer(images);
                } catch (error) {
                    console.error('解析图片数据失败:', error);
                }
            }
        }
    });
}

// 打开图片查看器
function openImageViewer(images) {
    const viewerModal = document.getElementById('image-viewer-modal');
    const imageElement = document.getElementById('current-task-image');
    const counterElement = document.getElementById('image-counter');
    
    if (!viewerModal || !imageElement || !counterElement) return;
    
    currentImages = images;
    currentImageIndex = 0;
    
    // 显示第一张图片
    updateViewerImage();
    
    // 显示模态窗口
    viewerModal.classList.remove('hidden');
    // 阻止页面滚动
    document.body.style.overflow = 'hidden';
    
    // 调整图片大小以适应窗口
    resizeImageToFitWindow();
    
    // 添加窗口大小变化监听
    window.addEventListener('resize', resizeImageToFitWindow);
}

// 调整图片大小以适应窗口
function resizeImageToFitWindow() {
    const imageElement = document.getElementById('current-task-image');
    if (!imageElement) return;
    
    // 获取窗口宽高
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 设置图片最大宽高为窗口的90%
    imageElement.style.maxWidth = `${windowWidth * 0.9}px`;
    imageElement.style.maxHeight = `${windowHeight * 0.9}px`;
    
    // 确保图片能完全显示
    imageElement.style.width = 'auto';
    imageElement.style.height = 'auto';
    imageElement.style.objectFit = 'contain';
}

// 关闭图片查看器
function closeImageViewer() {
    const viewerModal = document.getElementById('image-viewer-modal');
    if (viewerModal) {
        viewerModal.classList.add('hidden');
        // 恢复页面滚动
        document.body.style.overflow = '';
        
        // 移除窗口大小变化监听
        window.removeEventListener('resize', resizeImageToFitWindow);
    }
}

// 显示上一张图片
function showPreviousImage() {
    if (currentImages.length > 0) {
        currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
        updateViewerImage();
    }
}

// 显示下一张图片
function showNextImage() {
    if (currentImages.length > 0) {
        currentImageIndex = (currentImageIndex + 1) % currentImages.length;
        updateViewerImage();
    }
}

// 更新查看器中的图片
function updateViewerImage() {
    const imageElement = document.getElementById('current-task-image');
    const counterElement = document.getElementById('image-counter');
    
    if (!imageElement || !counterElement || currentImages.length === 0) return;
    
    let imageUrl = currentImages[currentImageIndex];
    
    // 检查URL是否已经是完整的URL（包含http）
    if (imageUrl && !imageUrl.startsWith('http')) {
        // 确保URL中不会有多余的斜杠
        const baseUrl = 'http://localhost:5000'; // 直接使用明确的基础URL
        const path = imageUrl && imageUrl.startsWith('/') ? imageUrl : imageUrl ? `/${imageUrl}` : '';
        imageUrl = `${baseUrl}${path}`;
    }
    
    imageElement.src = imageUrl;
    
    // 更新计数器
    counterElement.textContent = `${currentImageIndex + 1}/${currentImages.length}`;
    
    // 图片加载完成后调整大小
    imageElement.onload = function() {
        resizeImageToFitWindow();
    };
}

// 初始化番茄钟设置
function initTomatoSettings() {
    // 从localStorage加载设置
    const savedSettings = localStorage.getItem('tomatoSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            appState.fixedTomatoPage = settings.fixedTomatoPage || false;
        } catch (e) {
            console.error('加载番茄钟设置失败:', e);
        }
    }
    
    // 获取DOM元素
    const settingsBtn = document.getElementById('tomato-settings-btn');
    const settingsModal = document.getElementById('tomato-settings-modal');
    const closeBtn = document.getElementById('close-tomato-settings');
    const checkbox = document.getElementById('fixed-tomato-page');
    
    if (checkbox) {
        checkbox.checked = appState.fixedTomatoPage;
        
        // 添加复选框事件监听器
        checkbox.addEventListener('change', function() {
            appState.fixedTomatoPage = this.checked;
            // 保存到localStorage
            localStorage.setItem('tomatoSettings', JSON.stringify({
                fixedTomatoPage: appState.fixedTomatoPage
            }));
        });
    }
    
    // 设置按钮点击事件
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', function() {
            settingsModal.classList.remove('hidden');
            // 确保复选框状态正确
            if (checkbox) {
                checkbox.checked = appState.fixedTomatoPage;
            }
        });
    }
    
    // 关闭按钮点击事件
    if (closeBtn && settingsModal) {
        closeBtn.addEventListener('click', function() {
            settingsModal.classList.add('hidden');
        });
    }
    
    // 点击模态窗口外部关闭
    if (settingsModal) {
        settingsModal.addEventListener('click', function(event) {
            if (event.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }
}

// 初始化应用
// 初始化任务设置
function initTaskSettings() {
    // 从localStorage加载任务设置
    try {
        const savedSettings = localStorage.getItem('taskSettings');
        if (savedSettings) {
            appState.taskSettings = JSON.parse(savedSettings);
        }
    } catch (error) {
        console.error('加载任务设置失败:', error);
    }
    
    // 绑定任务设置按钮事件
    const taskSettingsBtn = document.getElementById('task-settings-btn');
    if (taskSettingsBtn) {
        taskSettingsBtn.addEventListener('click', showTaskSettingsModal);
    }
    
    // 绑定关闭按钮事件
    const closeTaskSettingsBtn = document.getElementById('close-task-settings');
    if (closeTaskSettingsBtn) {
        closeTaskSettingsBtn.addEventListener('click', hideTaskSettingsModal);
    }
    
    // 绑定保存设置按钮事件
    const saveTaskSettingsBtn = document.getElementById('save-task-settings');
    if (saveTaskSettingsBtn) {
        saveTaskSettingsBtn.addEventListener('click', saveTaskSettings);
    }
}

// 显示任务设置模态窗口
function showTaskSettingsModal() {
    const modal = document.getElementById('task-settings-modal');
    const autoSortCheckbox = document.getElementById('auto-sort-tasks');
    
    if (modal && autoSortCheckbox) {
        // 设置复选框状态
        autoSortCheckbox.checked = appState.taskSettings.autoSort;
        // 显示模态窗口
        modal.classList.remove('hidden');
    }
}

// 隐藏任务设置模态窗口
function hideTaskSettingsModal() {
    const modal = document.getElementById('task-settings-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 保存任务设置
function saveTaskSettings() {
    const autoSortCheckbox = document.getElementById('auto-sort-tasks');
    
    if (autoSortCheckbox) {
        // 更新设置
        appState.taskSettings.autoSort = autoSortCheckbox.checked;
        
        // 保存到localStorage
        try {
            localStorage.setItem('taskSettings', JSON.stringify(appState.taskSettings));
            domUtils.showToast('设置已保存');
            
            // 重新加载任务以应用排序
            if (appState.currentUser) {
                loadTasks();
            }
        } catch (error) {
            console.error('保存任务设置失败:', error);
            domUtils.showToast('保存设置失败', 'error');
        }
        
        // 关闭模态窗口
        hideTaskSettingsModal();
    }
}

function initApp() {
    // 检查用户登录状态
    const savedUser = storageUtils.getUser();
    if (savedUser) {
        appState.currentUser = savedUser;
        showMainApp();
        // 初始化番茄钟设置
        initTomatoSettings();
        // 初始化任务设置
        initTaskSettings();
        // 初始化任务图片上传功能
        initTaskImagesUpload();
        // 初始化图片查看器
        initImageViewer();
        // 初始化学科设置
        setTimeout(() => {
            try {
                window.subjectSettingsManager = new SubjectSettingsManager();
                console.log('学科设置管理器初始化成功');
            } catch (error) {
                console.error('学科设置管理器初始化失败:', error);
            }
        }, 500);
    } else {
        showLoginPage();
    }

    // 绑定事件
    bindEvents();
    
    // 确保番茄钟悬浮球默认隐藏
    ensureTomatoBubbleHidden();
    
    // 确保操作记录弹窗默认隐藏
    const logsModal = document.getElementById('operation-logs-modal');
    if (logsModal) {
        logsModal.classList.add('hidden');
    }
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    // 登录页不显示悬浮番茄球
    const bubble = document.getElementById('tomato-bubble');
    if (bubble) bubble.classList.add('hidden');
    // 登录页不显示底部导航栏
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.add('hidden');
    // 登录页不显示添加任务按钮
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) addTaskBtn.classList.add('hidden');
}

// 显示主应用
function showMainApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    // 显示底部导航栏
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.remove('hidden');
    // 显示添加任务按钮
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) addTaskBtn.classList.remove('hidden');
    
    // 初始化数据
    initData();
    
    // 更新用户信息显示
    updateUserInfo();
    
    // 检查是否有新的荣誉可以获取
    setTimeout(async () => {
        try {
            await checkNewHonors();
        } catch (error) {
            console.error('检查荣誉失败:', error);
        }
    }, 1000);
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
    
    // 绑定荣誉墙点击事件
    const honorTitles = document.querySelectorAll('h3');
    let honorTitle = null;
    for (const h3 of honorTitles) {
        if (h3.textContent.includes('我的荣誉')) {
            honorTitle = h3;
            break;
        }
    }
    if (honorTitle) {
        honorTitle.addEventListener('click', showHonorWall);
        honorTitle.style.cursor = 'pointer';
        honorTitle.classList.add('hover:bg-gray-50', 'p-2', '-mx-2', 'rounded-lg', 'transition-colors');
    }
    
    // 绑定关闭荣誉墙事件
    const closeHonorWallBtn = document.getElementById('close-honor-wall');
    const honorWallModal = document.getElementById('honor-wall-modal');
    
    if (closeHonorWallBtn) {
        closeHonorWallBtn.addEventListener('click', hideHonorWall);
    }
    
    // 为弹窗外层添加点击事件，实现点击外侧区域关闭
    if (honorWallModal) {
        honorWallModal.addEventListener('click', (event) => {
            // 检查点击目标是否是弹窗的外层容器本身（不是内容区域）
            if (event.target === honorWallModal) {
                hideHonorWall();
            }
        });
        
        // 优化弹窗的高度自适应
        function updateModalHeight() {
            const viewportHeight = window.innerHeight;
            const modalContent = honorWallModal.querySelector('div.bg-white');
            
            if (modalContent) {
                // 设置最大高度为视口高度的90%
                modalContent.style.maxHeight = `${viewportHeight * 0.9}px`;
                // 确保内容区域可以滚动
                const contentArea = modalContent.querySelector('.overflow-y-auto');
                if (contentArea) {
                    contentArea.style.maxHeight = `${viewportHeight * 0.65}px`;
                }
            }
        }
        
        // 初始调用一次
        updateModalHeight();
        // 监听窗口大小变化
        window.addEventListener('resize', updateModalHeight);
    }
    
    // 绑定荣誉筛选按钮事件
    const filterBtns = document.querySelectorAll('.honor-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按钮的active状态
            filterBtns.forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'text-yellow-800');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            
            // 为当前按钮添加active状态
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            btn.classList.add('active', 'bg-yellow-100', 'text-yellow-800');
            
            // 筛选荣誉
            const filter = btn.dataset.filter;
            filterHonors(filter);
        });
    });
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
    
    // 使用事件委托为任务图片图标绑定点击事件
    document.addEventListener('click', (e) => {
        const imagesIcon = e.target.closest('.task-images-icon');
        if (imagesIcon) {
            const imagesData = imagesIcon.getAttribute('data-images');
            const images = tryParseJSON(imagesData) || [];
            if (images.length > 0) {
                // 将相对路径转换为完整URL
                const fullImageUrls = images.map(img => {
                    // 检查是否已经是完整URL
                    if (img.startsWith('http://') || img.startsWith('https://')) {
                        return img;
                    }
                    // 对于相对路径，添加API基础URL
                    return `http://localhost:5000${img}`;
                });
                openImageViewer(fullImageUrls);
            }
        }
    });
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
                // 固定页面模式下，无论番茄钟是在计时状态还是暂停状态，都不允许点击外部区域关闭
                if (!appState.fixedTomatoPage) {
                    hideTomatoModal();
                }
            }
        });
    }

    // 小心愿页面事件
    document.getElementById('exchange-history').addEventListener('click', showExchangeHistory);

    // 我的页面事件
    
    document.getElementById('clear-data').addEventListener('click', handleClearData);
    document.getElementById('operation-logs').addEventListener('click', showOperationLogs);
    
    // 荣誉墙相关事件
    const honorListSection = document.getElementById('honor-list');
    if (honorListSection) {
        honorListSection.addEventListener('click', showHonorWall);
    }
    
    if (document.getElementById('close-honor-wall')) {
        document.getElementById('close-honor-wall').addEventListener('click', hideHonorWall);
    }
    
    if (document.getElementById('close-celebration')) {
        document.getElementById('close-celebration').addEventListener('click', hideCelebration);
    }
    
    // 荣誉筛选按钮事件
    const filterBtns = document.querySelectorAll('.honor-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新按钮状态
            filterBtns.forEach(b => {
                b.classList.remove('bg-yellow-100', 'text-yellow-800');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            btn.classList.add('bg-yellow-100', 'text-yellow-800');
            
            // 执行筛选
            const filter = btn.dataset.filter;
            filterHonors(filter);
        });
    });
    
    // 操作记录弹窗事件
    if(document.getElementById('close-operation-logs')) {
        document.getElementById('close-operation-logs').addEventListener('click', hideOperationLogs);
    }
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
        if(wishPageTitle) wishPageTitle.textContent = `${appState.currentUser.nickname || appState.currentUser.username}的心愿收集`;
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
// 将loadTasks函数暴露到window对象，供其他模块使用
async function loadTasks() {
    window.loadTasks = loadTasks;
    const taskList = document.getElementById('task-list');
    
    // 根据当前选择的日期生成动态标题
    const today = dateUtils.getCurrentDate();
    const currentDate = appState.currentDate;
    let taskTitle = '今日任务';
    
    // 如果不是今天，显示具体日期
    if (currentDate !== today) {
        try {
            // 解析日期字符串为Date对象
            const dateObj = new Date(currentDate);
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            taskTitle = `${month}月${day}日任务`;
        } catch (error) {
            console.error('日期解析失败:', error);
        }
    }
    
    // 先清空任务列表并显示加载中状态
    taskList.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">${taskTitle}</h3>
            <div class="flex space-x-2">
                <button id="filter-all" class="px-3 py-1 rounded-full bg-green-600 text-white text-sm">全部</button>
                <button id="filter-completed" class="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm">已完成</button>
                <button id="filter-pending" class="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm">待完成</button>
            </div>
        </div>
        <div class="text-center text-gray-500 py-8">
            加载中...
        </div>
    `;
    
    // 初始化任务数组为空数组，确保即使API失败也能正常显示
    let tasks = [];
    
    try {
        // 构建API URL - 对于子账号，后端会自动处理为主账号的任务
        const API_BASE_URL = 'http://localhost:5000/api';
        let url = `${API_BASE_URL}/tasks?user_id=${appState.currentUser.id}&date=${appState.currentDate}`;
        
        // 只有当分类有效且不是默认值时才添加category参数
        if (appState.currentCategory && appState.currentCategory !== '全部学科' && appState.currentCategory !== '') {
            url += `&category=${encodeURIComponent(appState.currentCategory)}`;
        }
        
        // 检查用户类型
        const isSubAccount = appState.currentUser && appState.currentUser.parent_id;
        console.log('用户信息:', { id: appState.currentUser.id, isSubAccount });
        console.log('请求URL:', url);
        
        // 发送请求
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        
        // 获取响应文本
        const text = await response.text();
        console.log('响应文本长度:', text.length);
        
        // 尝试解析JSON，但即使失败也继续执行
        if (text && text.trim()) {
            try {
                const parsedData = JSON.parse(text);
                // 处理不同格式的响应
                if (Array.isArray(parsedData)) {
                    tasks = parsedData;
                } else if (parsedData.tasks && Array.isArray(parsedData.tasks)) {
                    tasks = parsedData.tasks;
                }
                console.log('成功解析任务数据，共', tasks.length, '个任务');
            } catch (jsonError) {
                console.error('JSON解析失败:', jsonError);
                console.log('原始响应:', text);
            }
        } else {
            console.warn('响应为空');
        }
        
        // 更新统计数据
        if (typeof loadStatistics === 'function') {
            await loadStatistics();
        }
    } catch (error) {
        console.error('API请求失败:', error);
        
        // 显示错误提示
        const errorMessage = document.createElement('div');
        errorMessage.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg';
        errorMessage.textContent = '加载任务失败，请重试';
        document.body.appendChild(errorMessage);
        setTimeout(() => {
            errorMessage.remove();
        }, 3000);
    }
    
    // 无论如何都设置筛选按钮事件
    if (typeof setupFilterButtons === 'function') {
        setupFilterButtons(tasks);
    }
    
    // 更新筛选按钮状态
    if (typeof updateTaskFilterButtons === 'function') {
        updateTaskFilterButtons();
    }
    
    // 渲染任务列表
    if (typeof filterAndRenderTasks === 'function') {
        filterAndRenderTasks(tasks, currentFilter);
    }
}

// 独立的筛选按钮设置函数
function setupFilterButtons(tasks) {
    // 获取按钮元素
    const filterAll = document.getElementById('filter-all');
    const filterCompleted = document.getElementById('filter-completed');
    const filterPending = document.getElementById('filter-pending');
    
    if (!filterAll || !filterCompleted || !filterPending) {
        console.error('筛选按钮元素未找到');
        return;
    }
    
    // 移除所有事件监听器（通过克隆节点）
    const newFilterAll = filterAll.cloneNode(true);
    const newFilterCompleted = filterCompleted.cloneNode(true);
    const newFilterPending = filterPending.cloneNode(true);
    
    filterAll.parentNode.replaceChild(newFilterAll, filterAll);
    filterCompleted.parentNode.replaceChild(newFilterCompleted, filterCompleted);
    filterPending.parentNode.replaceChild(newFilterPending, filterPending);
    
    // 添加新的事件监听器
    newFilterAll.addEventListener('click', () => {
        currentFilter = 'all';
        appState.currentCategory = '';
        updateTaskFilterButtons();
        filterAndRenderTasks(tasks, 'all');
    });
    
    newFilterCompleted.addEventListener('click', () => {
        currentFilter = 'completed';
        appState.currentCategory = '';
        updateTaskFilterButtons();
        filterAndRenderTasks(tasks, 'completed');
    });
    
    newFilterPending.addEventListener('click', () => {
        currentFilter = 'pending';
        appState.currentCategory = '';
        updateTaskFilterButtons();
        filterAndRenderTasks(tasks, 'pending');
    });
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
    
    // 处理任务排序
    let categoriesToRender = Object.keys(tasksByCategory);
    
    if (appState.taskSettings.autoSort) {
        // 对学科进行排序：有未完成任务的学科排在前面
        categoriesToRender = categoriesToRender.sort((catA, catB) => {
            const hasPendingA = tasksByCategory[catA].some(task => task.status === '未完成');
            const hasPendingB = tasksByCategory[catB].some(task => task.status === '未完成');
            
            // 如果A有未完成任务而B没有，则A排在前面
            if (hasPendingA && !hasPendingB) return -1;
            // 如果B有未完成任务而A没有，则B排在前面
            if (!hasPendingA && hasPendingB) return 1;
            // 否则保持原有顺序
            return 0;
        });
    }
    
    // 渲染每个分类的任务
    categoriesToRender.forEach(category => {
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
        
        // 任务列表 - 如果开启自动排序，则学科内未完成任务排在前面
        let categoryTasks = tasksByCategory[category];
        if (appState.taskSettings.autoSort) {
            categoryTasks = categoryTasks.sort((taskA, taskB) => {
                // 未完成任务排在前面
                if (taskA.status === '未完成' && taskB.status === '已完成') return -1;
                if (taskA.status === '已完成' && taskB.status === '未完成') return 1;
                return 0; // 状态相同保持原顺序
            });
        }
        
        categoryTasks.forEach(task => {
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
                        <i class="fa ${iconClass} ${statusClass} text-3xl"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h4 class="font-medium text-base ${taskStatusClass} flex-1">${task.name}</h4>
                            <div class="flex items-center">
                                <button class="task-tomato p-1 hover:bg-green-100 rounded-full transition-colors duration-200 mr-2" title="番茄钟">
                                    <img src="static/images/番茄钟.png" alt="番茄钟" class="w-5 h-5">
                                </button>
                                <button class="task-menu p-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors duration-200" title="操作">
                                    <i class="fa fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between w-full mt-1">
                                ${task.description ? `<p class="text-sm text-gray-500 ${taskStatusClass} flex-1">${task.description}</p>` : '<div class="flex-1"></div>'}
                                <div class="flex items-center space-x-3">
                                    ${task.images && tryParseJSON(task.images) && tryParseJSON(task.images).length > 0 ? `
                                    <div class="task-images-icon flex items-center text-sm text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" data-task-id="${task.id}" data-images='${task.images}'>
                                        <i class="fa fa-image mr-1"></i>
                                        <span>图片</span>
                                    </div>
                                    ` : ''}
                                    <div class="flex items-center text-sm text-purple-600 font-medium">
                                        <i class="fa fa-clock-o mr-1"></i>
                                        <span>${task.planned_time}分钟</span>
                                    </div>
                                    ${isCompleted && task.actual_time ? `
                                    <div class="flex items-center text-sm text-green-600 font-medium">
                                        <i class="fa fa-check-circle mr-1"></i>
                                        <span>${task.actual_time}分钟</span>
                                    </div>
                                    ` : ''}
                                    <div class="flex items-center text-sm text-yellow-500 font-bold">
                                        <i class="fa fa-star mr-1"></i>
                                        <span>${task.points}分</span>
                                    </div>
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
    try {
        // 先获取任务信息（用于金币与时间处理和权限检查）
        const tasks = await api.taskAPI.getTasks(appState.currentUser.id, appState.currentDate, '');
        const task = tasks.find(t => t.id === taskId);
        
        // 检查是否有编辑权限
        if (task && task.can_edit === false) {
            domUtils.showToast('无权限修改任务状态', 'error');
            return;
        }
        
        const newStatus = currentStatus === '已完成' ? '未完成' : '已完成';

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
        
        // 直接更新DOM中任务卡片的状态，而不是重新加载整个任务列表
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            // 更新图标状态
            const statusIcon = taskElement.querySelector('.fa-circle-o, .fa-check-circle');
            if (statusIcon) {
                statusIcon.className = newStatus === '已完成' ? 'fa fa-check-circle text-green-500 text-3xl' : 'fa fa-circle-o text-gray-400 text-3xl';
            }
            
            // 更新任务名称样式（划线效果）
            const taskNameElement = taskElement.querySelector('h4.font-medium');
            if (taskNameElement) {
                if (newStatus === '已完成') {
                    taskNameElement.classList.add('line-through', 'text-gray-400');
                } else {
                    taskNameElement.classList.remove('line-through', 'text-gray-400');
                }
            }
            
            // 如果启用了任务自动排序，调整任务在列表中的位置
            if (appState.taskSettings?.autoSort) {
                const categoryElement = taskElement.closest('.category-tasks');
                if (categoryElement) {
                    // 获取该分类下所有任务
                    const tasksInCategory = Array.from(categoryElement.querySelectorAll('.task-card'));
                    // 按状态排序：未完成的排在前面
                    tasksInCategory.sort((a, b) => {
                        const statusA = a.querySelector('.fa-check-circle') ? '已完成' : '未完成';
                        const statusB = b.querySelector('.fa-check-circle') ? '已完成' : '未完成';
                        if (statusA === '未完成' && statusB === '已完成') return -1;
                        if (statusA === '已完成' && statusB === '未完成') return 1;
                        return 0;
                    });
                    
                    // 重新排序DOM元素
                    tasksInCategory.forEach(taskEl => {
                        categoryElement.appendChild(taskEl);
                    });
                    
                    // 检查是否需要重新排序整个分类
                    if (window.sortCategoriesByCompletion) {
                        sortCategoriesByCompletion();
                    }
                }
            }
        }
        
        // 仍然更新统计数据和用户信息，因为这些是全局性的数据
        await loadStatistics();
        await updateUserInfo(); // 确保金币数据一致性
        
        domUtils.showToast('任务状态已更新');
    } catch (error) {
        console.error('更新任务状态失败:', error);
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
    const addTaskModal = document.getElementById('add-task-modal');
    const taskForm = document.getElementById('task-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (addTaskModal) {
        addTaskModal.classList.add('hidden');
    }
    
    // 清除图片预览
    clearTaskImagesPreview();
    
    // 重置表单状态
    if (taskForm) {
        taskForm.reset();
        taskForm.dataset.editMode = 'false';
        taskForm.dataset.taskId = '';
    }
    
    // 重置模态框标题
    if (modalTitle) {
        modalTitle.textContent = '添加任务';
    }
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
    const fileInput = document.getElementById('task-images-upload');
    
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
            
            // 处理图片上传和已存在的图片
            const previewContainer = document.getElementById('uploaded-images-preview');
            let allImages = [];
            
            // 获取已删除的图片列表
            const deletedImages = taskForm.dataset.deletedImages ? JSON.parse(taskForm.dataset.deletedImages) : [];
            
            // 1. 收集已存在的图片（标记为existingImage的），并排除已删除的图片
            if (previewContainer) {
                const existingImageElements = previewContainer.querySelectorAll('[data-existing-image="true"] img');
                existingImageElements.forEach(img => {
                    // 从完整URL中提取相对路径（去掉API_BASE_URL）
                    let imageUrl = img.src;
                    if (imageUrl.startsWith(API_BASE_URL)) {
                        imageUrl = imageUrl.substring(API_BASE_URL.length);
                    } else if (imageUrl.startsWith('http://localhost:5000')) {
                        imageUrl = imageUrl.substring('http://localhost:5000'.length);
                    }
                    
                    // 检查是否在已删除列表中
                    const isDeleted = deletedImages.some(deletedUrl => 
                        imageUrl.includes(deletedUrl) || deletedUrl.includes(imageUrl)
                    );
                    
                    if (!isDeleted) {
                        allImages.push(imageUrl);
                    }
                });
            }
            
            // 2. 上传新图片并添加到现有图片列表
            if (fileInput && fileInput.files.length > 0) {
                const uploadResult = await api.taskAPI.uploadTaskImages(taskId, fileInput.files);
                if (uploadResult.success && uploadResult.image_urls && uploadResult.image_urls.length > 0) {
                    allImages = [...allImages, ...uploadResult.image_urls];
                }
            }
            
            // 3. 更新任务的images字段，使用所有保留的和新上传的图片URL
            if (allImages.length > 0) {
                await api.taskAPI.updateTask(taskId, { images: JSON.stringify(allImages) });
            } else {
                // 如果没有保留任何图片，则清空图片字段
                await api.taskAPI.updateTask(taskId, { images: JSON.stringify([]) });
            }
            
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
            
            // 处理图片上传
            if (result.success && result.task_id && fileInput && fileInput.files.length > 0) {
                const uploadResult = await api.taskAPI.uploadTaskImages(result.task_id, fileInput.files);
                if (uploadResult.success && uploadResult.image_urls && uploadResult.image_urls.length > 0) {
                    // 更新任务的images字段，使用所有上传的图片URL
                    await api.taskAPI.updateTask(result.task_id, { images: JSON.stringify(uploadResult.image_urls) });
                }
            }
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
    
    // 根据任务的can_edit属性决定是否显示编辑和删除按钮
    const canEdit = task.can_edit !== false; // 默认可以编辑
    
    let menuHTML = '';
    
    // 如果可以编辑，添加编辑按钮
    if (canEdit) {
        menuHTML += `
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded">
            <i class="fa fa-pencil text-gray-600 mr-3"></i>
            <span>编辑</span>
        </button>`;
    }
    
    // 番茄钟按钮始终显示
    menuHTML += `
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded">
            <i class="fa fa-clock-o text-yellow-500 mr-3"></i>
            <span>番茄钟</span>
        </button>`;
    
    // 如果可以编辑，添加删除按钮
    if (canEdit) {
        menuHTML += `
        <button class="task-menu-item w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 rounded text-red-600">
            <i class="fa fa-trash mr-3"></i>
            <span>删除</span>
        </button>`;
    }
    
    menuElement.innerHTML = menuHTML;
    
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
    
    // 检查是否有编辑权限
    if (task.can_edit === false) {
        domUtils.showToast('无权限编辑任务', 'error');
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
        
        // 显示任务已有的图片
        const previewContainer = document.getElementById('uploaded-images-preview');
        const fileInput = document.getElementById('task-images-upload');
        
        if (previewContainer && task.images) {
            const taskImages = tryParseJSON(task.images);
            if (taskImages && taskImages.length > 0) {
                previewContainer.classList.remove('hidden');
                previewContainer.innerHTML = '';
                
                taskImages.forEach((imageUrl, index) => {
                    const previewWrapper = document.createElement('div');
                    previewWrapper.className = 'relative group';
                    previewWrapper.dataset.index = index;
                    previewWrapper.dataset.existingImage = 'true'; // 标记为已存在的图片
                    
                    const preview = document.createElement('img');
                    // 确保图片URL是完整的，并且正确处理路径分隔符
                    let fullImageUrl;
                    if (imageUrl && imageUrl.startsWith('http')) {
                        fullImageUrl = imageUrl;
                    } else {
                        // 确保URL中不会有多余的斜杠
                        const baseUrl = 'http://localhost:5000'; // 直接使用基础URL
                        const path = imageUrl && imageUrl.startsWith('/') ? imageUrl : imageUrl ? `/${imageUrl}` : '';
                        fullImageUrl = `${baseUrl}${path}`;
                    }
                    preview.src = fullImageUrl;
                    preview.className = 'w-full h-20 object-contain rounded-md border border-gray-200 bg-white';
                    preview.alt = '图片预览';
                    
                    // 添加点击放大功能
                    preview.addEventListener('click', () => {
                        const allImages = taskImages.map(imgUrl => {
                            if (imgUrl && imgUrl.startsWith('http')) {
                                return imgUrl;
                            } else {
                                const path = imgUrl && imgUrl.startsWith('/') ? imgUrl : imgUrl ? `/${imgUrl}` : '';
                                return `http://localhost:5000${path}`;
                            }
                        });
                        openImageViewer(allImages);
                        currentImageIndex = index;
                        updateViewerImage();
                    });
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity';
                    removeBtn.innerHTML = '<i class="fa fa-times text-xs"></i>';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        // 标记图片为已删除
                        if (!taskForm.dataset.deletedImages) {
                            taskForm.dataset.deletedImages = JSON.stringify([]);
                        }
                        const deletedImages = JSON.parse(taskForm.dataset.deletedImages);
                        deletedImages.push(imageUrl); // 添加到已删除图片列表
                        taskForm.dataset.deletedImages = JSON.stringify(deletedImages);
                        
                        previewWrapper.remove();
                        
                        // 如果没有预览图片了，隐藏预览容器
                        if (previewContainer.children.length === 0) {
                            previewContainer.classList.add('hidden');
                        }
                    });
                    
                    previewWrapper.appendChild(preview);
                    previewWrapper.appendChild(removeBtn);
                    previewContainer.appendChild(previewWrapper);
                });
            }
        }
        
        // 添加键盘事件监听，处理输入法弹出
        setTimeout(() => {
            adjustModalPosition();
        }, 100);
    }
}

// 删除任务
async function deleteTask(taskId) {
    try {
        // 先获取任务信息，检查权限
        const tasks = await api.taskAPI.getTasks(appState.currentUser.id, appState.currentDate, '');
        const task = tasks.find(t => t.id === taskId);
        
        // 检查是否有删除权限
        if (task && task.can_edit === false) {
            domUtils.showToast('无权限删除任务', 'error');
            return;
        }
    } catch (error) {
        console.error('检查任务权限失败:', error);
        domUtils.showToast('检查权限失败，请重试', 'error');
        return;
    }
    
    domUtils.showConfirm(
        '确认删除',
        '确定要删除这个任务吗？',
        async () => {
            try {
                // 先获取任务信息，检查是否已完成
                const tasks = await api.taskAPI.getTasks(appState.currentUser.id, appState.currentDate, '');
                const task = tasks.find(t => t.id === taskId);
                
                // 如果是已完成的任务，在UI上先显示临时扣除，提升响应感
                // 注意：实际的金币扣除在后端API中执行，避免重复扣除
                if (task && task.status === '已完成' && task.points > 0) {
                    const deductAmount = -task.points; // 负值表示扣除
                    try {
                        const dayEl = document.getElementById('day-gold');
                        const totalEl = document.getElementById('total-gold');
                        if (dayEl) dayEl.textContent = Math.max(0, (parseInt(dayEl.textContent || '0', 10) + deductAmount)).toString();
                        if (totalEl) totalEl.textContent = Math.max(0, (parseInt(totalEl.textContent || '0', 10) + deductAmount)).toString();
                    } catch (e) {
                        // 忽略格式化错误
                    }
                }
                
                // 删除任务（后端会处理金币扣除）
                await api.taskAPI.deleteTask(taskId);
                
                // 重新加载任务列表和统计数据
                await loadTasks();
                await loadStatistics();
                await updateUserInfo(); // 确保金币数据一致性
                
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
    appState.tomatoMode = 'countdown'; // 默认使用倒计时模式
    appState.tomatoElapsedSeconds = 0; // 重置已用时间

    const tomatoModal = document.getElementById('tomato-modal');
    const tomatoTimerElement = document.getElementById('tomato-timer');
    const tomatoTaskNameElement = document.getElementById('tomato-task-name');
    const customInput = document.getElementById('tomato-custom-minutes');
    const countdownModeBtn = document.getElementById('tomato-countdown-mode');
    const stopwatchModeBtn = document.getElementById('tomato-stopwatch-mode');
    const countdownOptions = document.getElementById('tomato-countdown-options');

    // 默认使用任务计划时间或20分钟
    const defaultMinutes = parseInt(task.planned_time || 20, 10);

    // 更新UI
    if (tomatoTaskNameElement) tomatoTaskNameElement.textContent = `番茄钟 - ${task.name}`;
    if (customInput) customInput.value = defaultMinutes;

    // 设置模式按钮样式
        if (countdownModeBtn) countdownModeBtn.className = 'px-4 py-2 rounded-full bg-pink-100 text-pink-700 font-semibold shadow-sm';
        if (stopwatchModeBtn) stopwatchModeBtn.className = 'px-4 py-2 rounded-full bg-blue-50 text-blue-600 font-semibold shadow-sm';
    if (countdownOptions) countdownOptions.style.display = 'flex';

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
        // 计时模式切换事件
        if (countdownModeBtn) {
            countdownModeBtn.addEventListener('click', () => {
                appState.tomatoMode = 'countdown';
                countdownModeBtn.className = 'px-4 py-2 rounded-full bg-pink-100 text-pink-700 font-semibold shadow-sm';
                stopwatchModeBtn.className = 'px-4 py-2 rounded-full bg-blue-50 text-blue-600 font-semibold shadow-sm';
                if (countdownOptions) countdownOptions.style.display = 'flex';
                // 重置到默认时间
                const defaultMins = parseInt(customInput.value || task.planned_time || 20, 10);
                appState.tomatoTimeLeft = defaultMins * 60;
                appState.tomatoElapsedSeconds = 0;
                updateTomatoDisplays();
            });
        }

        if (stopwatchModeBtn) {
            stopwatchModeBtn.addEventListener('click', () => {
                appState.tomatoMode = 'stopwatch';
                stopwatchModeBtn.className = 'px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold shadow-sm';
                countdownModeBtn.className = 'px-4 py-2 rounded-full bg-pink-50 text-pink-600 font-semibold shadow-sm';
                if (countdownOptions) countdownOptions.style.display = 'none';
                appState.tomatoElapsedSeconds = 0;
                updateTomatoDisplays();
            });
        }

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

        // 暂停/恢复
        const pauseBtn = document.getElementById('tomato-pause');
        if (pauseBtn) pauseBtn.addEventListener('click', handleTomatoPause);

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
    
    // 根据当前模式显示不同的时间
    const displayTime = appState.tomatoMode === 'stopwatch' ? appState.tomatoElapsedSeconds : appState.tomatoTimeLeft;
    
    if (timerElement) timerElement.textContent = formatTime(displayTime);
    if (bubbleElement) bubbleElement.textContent = formatTime(displayTime);
}

// 开始计时并根据设置决定是否收起为悬浮球
function handleTomatoStart() {
    // 如果已经在运行，忽略
    if (appState.tomatoTimer) return;
    
    // 更新暂停按钮文本为"暂停"
    const pauseBtn = document.getElementById('tomato-pause');
    if (pauseBtn) pauseBtn.textContent = '暂停';

    if (appState.tomatoMode === 'countdown') {
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
    } else {
        // 正计时模式，重置已用时间
        appState.tomatoElapsedSeconds = 0;
        appState.tomatoTotalSeconds = 3600; // 假设最大1小时用于动画
    }
    
    updateTomatoDisplays();

    // 根据模式选择计时逻辑
    if (appState.tomatoMode === 'countdown') {
        // 倒计时模式
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
    } else {
        // 正计时模式
        appState.tomatoTimer = setInterval(() => {
            appState.tomatoElapsedSeconds++;
            updateTomatoDisplays();
        }, 1000);
    }

    // 根据设置决定是收起为悬浮球还是保持弹窗显示
    if (!appState.fixedTomatoPage) {
        // 非固定模式：收起 modal 并强制显示悬浮球
        hideTomatoModal();
        const bubble = document.getElementById('tomato-bubble');
        if (bubble) {
            // 无论当前页面如何，开始后立刻显示悬浮球，页面切换时会重新评估可见性
            bubble.classList.remove('hidden');
        }
    }
    // 固定模式：保持弹窗显示，不显示悬浮球

    // 启动水位动画
    startWaterFillAnimation();
}

// 关闭按钮行为：根据设置决定关闭行为
function handleTomatoClose() {
    if (appState.fixedTomatoPage && appState.tomatoTimer) {
        // 固定模式下，即使在计时中也直接关闭弹窗
        const modal = document.getElementById('tomato-modal');
        if (modal) modal.classList.add('hidden');
        // 同时隐藏悬浮球
        const bubble = document.getElementById('tomato-bubble');
        if (bubble) bubble.classList.add('hidden');
    } else if (appState.tomatoTimer) {
        // 非固定模式且在计时中：收起为悬浮球
        hideTomatoModal();
    } else {
        // 未在计时：直接关闭
        const modal = document.getElementById('tomato-modal');
        if (modal) modal.classList.add('hidden');
    }
}

// 隐藏 modal，并在计时时显示悬浮球
function hideTomatoModal() {
    const modal = document.getElementById('tomato-modal');
    const bubble = document.getElementById('tomato-bubble');
    if (modal) modal.classList.add('hidden');
    if (bubble && !appState.fixedTomatoPage) {
        // 只有在非固定模式下才显示悬浮球
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
    
    // 只有在计时中才显示悬浮球，无论当前在哪个页面
    // 移除页面限制，确保计时开始后能在任何页面显示悬浮球
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

// 暂停/恢复：暂停或恢复当前计时
function handleTomatoPause() {
    const pauseBtn = document.getElementById('tomato-pause');
    
    if (appState.tomatoTimer) {
        // 当前正在计时，需要暂停
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
        if (pauseBtn) {
            pauseBtn.textContent = '继续';
            // 暂停状态下，设置不同的样式颜色（蓝色系）
            pauseBtn.style.background = 'linear-gradient(135deg, #60a5fa, #3b82f6)';
            pauseBtn.style.color = '#fff';
            pauseBtn.style.border = 'none';
        }
        // 暂停水位动画
        if (appState._waterRaf) {
            cancelAnimationFrame(appState._waterRaf);
            appState._waterRaf = null;
        }
    } else {
        // 当前已暂停，需要恢复计时
        // 根据模式选择计时逻辑
        if (appState.tomatoMode === 'countdown') {
            // 倒计时模式
            appState.tomatoTimer = setInterval(() => {
                appState.tomatoTimeLeft--;
                if (appState.tomatoTimeLeft <= 0) {
                    clearInterval(appState.tomatoTimer);
                    appState.tomatoTimer = null;
                    if (pauseBtn) {
                        pauseBtn.textContent = '暂停';
                        // 恢复默认样式
                        pauseBtn.style.background = '#fff';
                        pauseBtn.style.border = '2px solid rgba(255,105,135,0.2)';
                        pauseBtn.style.color = '#ff6b6b';
                    }
                    handleTomatoFinish();
                    return;
                }
                updateTomatoDisplays();
            }, 1000);
        } else {
            // 正计时模式
            appState.tomatoTimer = setInterval(() => {
                appState.tomatoElapsedSeconds++;
                updateTomatoDisplays();
            }, 1000);
        }
        
        if (pauseBtn) {
            pauseBtn.textContent = '暂停';
            // 恢复默认样式
            pauseBtn.style.background = '#fff';
            pauseBtn.style.border = '2px solid rgba(255,105,135,0.2)';
            pauseBtn.style.color = '#ff6b6b';
        }
        // 重新启动水位动画
        startWaterFillAnimation();
        
        // 根据固定页面设置决定显示方式
        if (!appState.fixedTomatoPage) {
            // 非固定页面模式下，显示悬浮球并隐藏番茄钟页面
            ensureTomatoBubbleHidden();
            hideTomatoModal();
        } else {
            // 固定页面模式下，隐藏悬浮球，保持番茄钟页面显示
            const bubble = document.getElementById('tomato-bubble');
            if (bubble) bubble.classList.add('hidden');
        }
    }
}

// 完成：停止计时并标记任务完成，更新后端和界面
async function handleTomatoFinish() {
    if (appState.tomatoTimer) {
        clearInterval(appState.tomatoTimer);
        appState.tomatoTimer = null;
    }
    
    // 重置暂停按钮文本和样式为默认状态
    const pauseBtn = document.getElementById('tomato-pause');
    if (pauseBtn) {
        pauseBtn.textContent = '暂停';
        // 恢复默认样式
        pauseBtn.style.background = '#fff';
        pauseBtn.style.border = '2px solid rgba(255,105,135,0.2)';
        pauseBtn.style.color = '#ff6b6b';
    }
    
    // 隐藏UI
    const bubble = document.getElementById('tomato-bubble');
    const modal = document.getElementById('tomato-modal');
    if (bubble) bubble.classList.add('hidden');
    if (modal) modal.classList.add('hidden');

    // 更新后端任务为已完成，根据模式使用不同的实际时间
    try {
        if (appState.tomatoTaskId) {
            // 计算实际使用时间（分钟）
            let actualMinutes;
            if (appState.tomatoMode === 'stopwatch') {
                // 正计时模式：使用已用时间（秒转分钟，向上取整）
                actualMinutes = Math.ceil(appState.tomatoElapsedSeconds / 60);
            } else {
                // 倒计时模式：使用计划时间减去番茄钟结束时的剩余时间
                // 这样实际完成时间就是真正使用的时间
                const totalSeconds = (appState.currentTask?.planned_time || 20) * 60;
                const remainingSeconds = appState.tomatoTimeLeft || 0;
                const actualUsedSeconds = totalSeconds - remainingSeconds;
                actualMinutes = Math.ceil(actualUsedSeconds / 60);
            }
            
            await api.taskAPI.updateTask(appState.tomatoTaskId, { 
                status: '已完成', 
                actual_time: actualMinutes, 
                used_tomato: true 
            });
        }
        // 刷新列表与统计
        await loadTasks();
        await loadStatistics();
        await updateUserInfo();
        await loadHonors();
        
        // 检查是否有新的荣誉可以获取
        await checkNewHonors();
        
        domUtils.showToast('番茄钟完成，任务已标记为完成');
    } catch (err) {
        console.error('番茄钟完成时更新失败', err);
        domUtils.showToast('更新任务失败，请重试', 'error');
    }
    // 清理动画相关状态
    if (appState._waterRaf) cancelAnimationFrame(appState._waterRaf);
    appState.tomatoTotalSeconds = null;
    appState._waterRaf = null;
    appState.tomatoElapsedSeconds = 0;
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
                    <button class="wish-exchange bg-yellow-500 text-white py-1 px-3 rounded-lg hover:shadow-sm transition-all duration-200 text-xs font-medium">
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
    // 获取心愿详情，包含兑换数量信息
    const wishes = await api.wishAPI.getWishes(appState.currentUser.id);
    const wish = wishes.find(w => w.id === wishId);
    const userInfo = await api.userAPI.getUserInfo(appState.currentUser.id);
    
    // 让用户输入兑换数量
    domUtils.showPrompt(
        '输入兑换数量',
        wish.exchange_amount && wish.unit 
            ? `请输入要兑换的${wishName}数量（每${wish.exchange_amount}${wish.unit}需要${cost}金币）`
            : `请输入要兑换的${wishName}数量（每个需要${cost}金币）`,
        '1', // 默认兑换1个
        async (quantityStr) => {
            // 验证输入数量
            const quantity = parseInt(quantityStr);
            if (isNaN(quantity) || quantity <= 0) {
                domUtils.showToast('请输入有效的兑换数量', 'error');
                return;
            }
            
            // 计算总金币消耗
            const totalCost = cost * quantity;
            
            // 检查金币是否足够
            if (userInfo.user.total_gold < totalCost) {
                domUtils.showToast('金币不足，无法兑换', 'error');
                return;
            }
            
            // 显示确认弹窗
            let confirmMessage = `确定要花费 ${totalCost} 金币兑换 ${quantity} 个「${wishName}」吗？`;
            if (wish.exchange_amount && wish.unit) {
                const totalAmount = quantity * wish.exchange_amount;
                confirmMessage = `确定要花费 ${totalCost} 金币兑换 ${totalAmount}${wish.unit} 的「${wishName}」吗？`;
            }
            
            domUtils.showConfirm(
                '确认兑换',
                confirmMessage,
                async () => {
                    try {
                        // 执行兑换操作
                        const result = await api.wishAPI.exchangeWish(wishId, appState.currentUser.id, quantity);
                        if (result.success) {
                            // 更新页面数据
                            await loadWishes();
                            await loadStatistics();
                            await updateUserInfo(); // 确保所有页面的金币显示一致
                            // 显示兑换成功提示
                            domUtils.showToast(`兑换成功${quantity}个${wishName}（扣除${totalCost}金币）`);
                        }
                    } catch (error) {
                        console.error('兑换失败:', error);
                        domUtils.showToast('兑换失败，请重试', 'error');
                    }
                }
            );
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
            // 使用API返回的所有需要后端维护的字段
            if (userInfo.user) {
                // 合并所有字段，包括子账号相关信息
                user = {
                    ...user, 
                    id: userInfo.user.id, 
                    total_gold: userInfo.user.total_gold, 
                    avatar: userInfo.user.avatar,
                    role: userInfo.user.role,
                    parent_id: userInfo.user.parent_id,
                    parent_info: userInfo.user.parent_info,
                    permissions: userInfo.user.permissions
                };
                
                // 如果是子账号，获取父账号的金币数据
                if (user.parent_id) {
                    try {
                        const parentInfo = await api.userAPI.getUserInfo(user.parent_id);
                        if (parentInfo.user) {
                            // 子账号使用父账号的金币数据
                            user.total_gold = parentInfo.user.total_gold;
                        }
                    } catch (parentApiError) {
                        console.log('获取父账号信息失败，继续使用当前金币数据');
                    }
                }
                
                // 同步更新appState中的信息
                Object.assign(appState.currentUser, user);
                // 保存到本地存储
                storageUtils.saveUser(appState.currentUser);
            }
        } catch (apiError) {
            // API调用失败不影响本地信息的更新显示
            console.log('API调用失败，使用本地用户信息');
        }
        
        // 更新我的页面信息
        if(document.getElementById('profile-username')) document.getElementById('profile-username').textContent = user.username;
        if(document.getElementById('profile-id')) document.getElementById('profile-id').textContent = `ID: ${user.id.toString().padStart(6, '0')}`;
        
        // 显示子账号状态和父账号信息
        const isSubAccount = user.parent_id !== null && user.parent_id !== undefined;
        if(isSubAccount && user.parent_info) {
            // 如果是子账号，显示子账号标识和父账号信息
            let accountTypeText = `子账号 · ${user.parent_info.nickname || user.parent_info.username}`;
            if(document.getElementById('profile-account-type')) {
                document.getElementById('profile-account-type').textContent = accountTypeText;
                document.getElementById('profile-account-type').classList.remove('hidden');
            }
        } else {
            // 主账号隐藏子账号标识
            if(document.getElementById('profile-account-type')) {
                document.getElementById('profile-account-type').classList.add('hidden');
            }
        }
        
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
        if(document.getElementById('wish-page-title')) document.getElementById('wish-page-title').textContent = `${user.nickname || user.username}的心愿收集`;
        
        // 更新金币显示 - 确保所有位置金币数一致
        const goldValue = user.total_gold || 0;
        if(document.getElementById('total-gold')) document.getElementById('total-gold').textContent = goldValue;
        if(document.getElementById('total-gold-stats')) document.getElementById('total-gold-stats').textContent = goldValue;
        if(document.getElementById('wish-gold')) document.getElementById('wish-gold').textContent = goldValue;
        
        // 根据子账号权限控制功能按钮
        const permissions = user.permissions || {};
        const viewOnly = permissions.view_only !== false;
        
        // 控制添加任务按钮
        if(viewOnly) {
            // 仅查看权限时禁用添加任务按钮
            const addTaskButtons = document.querySelectorAll('#add-task-btn, #task-page-add-btn');
            addTaskButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            });
        } else {
            // 可编辑权限时启用添加任务按钮
            const addTaskButtons = document.querySelectorAll('#add-task-btn, #task-page-add-btn');
            addTaskButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            });
        }
        
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
                            <label for="wish-icon-upload" class="inline-block px-3 py-1.5 bg-blue-500 text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity w-full text-center text-sm">
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
                        <!-- 移除金币图标 -->
                        <input type="number" id="edit-wish-cost" min="1" class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none">
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
                
                <div class="flex justify-center gap-3">
                    <button id="delete-wish-btn" class="bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100 transition-colors duration-200 font-medium flex-1 max-w-[100px] text-sm">
                        <i class="fa fa-trash mr-1"></i> 删除
                    </button>
                    <button id="cancel-wish-btn" class="bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium flex-1 max-w-[100px] text-sm">
                        <i class="fa fa-times mr-1"></i> 取消
                    </button>
                    <button id="save-wish-btn" class="bg-yellow-500 text-white py-2 px-3 rounded-lg hover:opacity-90 transition-opacity duration-200 font-medium flex-1 max-w-[100px] text-sm">
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
                addWishBtn.className = 'bg-yellow-500 text-white py-1.5 px-4 rounded-full shadow-sm transform transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-sm';
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

// 加载荣誉列表 - 不显示任何内容，让荣誉区域不占用空间
async function loadHonors() {
    try {
        console.log('初始化荣誉区域');
        
        // 确保honor-list元素存在
        const honorList = document.getElementById('honor-list');
        if (!honorList) {
            console.error('honor-list元素不存在');
            return;
        }
        
        // 清空内容并设置不占用空间
        honorList.innerHTML = '';
        honorList.style.minHeight = '0';
        honorList.style.padding = '0';
        
        console.log('荣誉区域初始化完成');
    } catch (error) {
        console.error('初始化荣誉区域失败:', error);
    }
}

// 检查是否有新的荣誉可以获取
async function checkNewHonors() {
    try {
        // 添加详细的日志记录
        console.log('检查荣誉开始，用户对象:', appState.currentUser);
        
        // 更严格地检查用户ID
        const userId = appState.currentUser?.id;
        if (!userId || userId === undefined || userId === null || userId === '') {
            console.warn('无效的用户ID，跳过荣誉检查');
            return;
        }
        
        console.log('准备调用荣誉检查API，用户ID:', userId);
        
        try {
            const result = await api.honorAPI.checkAndGrantHonors(userId);
            
            console.log('荣誉检查结果:', result);
            
            if (result && result.new_honors && result.new_honors.length > 0) {
                console.log('发现新荣誉:', result.new_honors.length, '个');
                // 显示新获得的荣誉
                for (const honor of result.new_honors) {
                    try {
                        await showHonorCelebration(honor);
                    } catch (honorError) {
                        console.error('显示荣誉庆祝效果失败:', honor.name, honorError);
                    }
                }
                
                // 重新加载荣誉列表以更新显示
                try {
                    await loadHonors();
                } catch (loadError) {
                    console.error('重新加载荣誉列表失败:', loadError);
                }
            }
        } catch (apiError) {
            console.error('荣誉检查API调用失败:', apiError);
            // 这里可以添加重试逻辑，但暂时保持静默失败
        }
    } catch (error) {
        console.error('检查荣誉过程出现异常:', error);
        // 静默失败，不影响用户体验
    }
}

// 显示荣誉获得的庆祝效果
function showHonorCelebration(honor) {
    return new Promise((resolve) => {
        // 创建庆祝弹窗元素
        const celebrationModal = document.createElement('div');
        celebrationModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
        celebrationModal.style.opacity = '0';
        celebrationModal.style.transition = 'opacity 0.3s ease-in-out';
        
        // 为不同类型的荣誉选择不同的颜色
        let bgColor = 'bg-yellow-50';
        let headerColor = 'bg-yellow-500';
        let iconBgColor = 'bg-yellow-100';
        let iconColor = 'text-yellow-500';
        
        if (honor.name.includes('连续')) {
            bgColor = 'bg-blue-50';
            headerColor = 'bg-blue-500';
            iconBgColor = 'bg-blue-100';
            iconColor = 'text-blue-500';
        } else if (honor.name.includes('第一个')) {
            bgColor = 'bg-pink-50';
            headerColor = 'bg-pink-500';
            iconBgColor = 'bg-pink-100';
            iconColor = 'text-pink-500';
        } else if (honor.name.includes('学习')) {
            bgColor = 'bg-green-50';
            headerColor = 'bg-green-500';
            iconBgColor = 'bg-green-100';
            iconColor = 'text-green-500';
        }
        
        // 使用图标文件
        const iconPath = honor.icon ? `/static/images/honors/${honor.icon}` : '/static/images/honors/default.png';
        
        celebrationModal.innerHTML = `
            <div class="${bgColor} rounded-xl shadow-2xl overflow-hidden max-w-md w-full mx-4 transform transition-all duration-500 scale-90" id="celebration-content">
                <div class="${headerColor} text-white text-center py-3">
                    <h2 class="text-xl font-bold">恭喜获得新荣誉！</h2>
                </div>
                <div class="p-6">
                    <div class="flex flex-col items-center justify-center mb-4">
                        <div class="w-24 h-24 ${iconBgColor} rounded-full flex items-center justify-center mb-3 shadow-lg relative overflow-hidden">
                            <img src="${iconPath}" alt="${honor.name}" class="w-16 h-16 object-contain">
                            <div class="absolute inset-0 bg-white opacity-20 rounded-full"></div>
                        </div>
                        <h3 class="text-xl font-bold ${iconColor}">${honor.name}</h3>
                        <p class="text-gray-600 text-center mt-2">${honor.description || '继续努力，获得更多荣誉！'}</p>
                    </div>
                    <div class="text-center">
                        <button id="celebration-close" class="bg-gray-800 text-white py-2 px-6 rounded-full font-medium hover:bg-gray-700 transition-colors">
                            太棒了！
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(celebrationModal);
        
        // 创建五彩纸屑效果
        createConfetti();
        
        // 添加动画效果
        setTimeout(() => {
            celebrationModal.style.opacity = '1';
            document.getElementById('celebration-content').classList.remove('scale-90');
            document.getElementById('celebration-content').classList.add('scale-100');
        }, 10);
        
        // 关闭按钮事件
        document.getElementById('celebration-close').addEventListener('click', () => {
            celebrationModal.style.opacity = '0';
            document.getElementById('celebration-content').classList.remove('scale-100');
            document.getElementById('celebration-content').classList.add('scale-90');
            
            setTimeout(() => {
                document.body.removeChild(celebrationModal);
                clearConfetti();
                resolve();
            }, 300);
        });
        
        // 点击外部关闭
        celebrationModal.addEventListener('click', (e) => {
            if (e.target === celebrationModal) {
                document.getElementById('celebration-close').click();
            }
        });
    });
}

// 创建五彩纸屑效果
function createConfetti() {
    const confettiColors = ['#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#FF9F1C', '#E71D36', '#011627'];
    const confettiCount = 150;
    
    const confettiContainer = document.createElement('div');
    confettiContainer.id = 'confetti-container';
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-40';
    document.body.appendChild(confettiContainer);
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        
        // 随机形状和大小
        const size = Math.random() * 10 + 5;
        const shapeType = Math.floor(Math.random() * 3); // 0: circle, 1: square, 2: triangle
        
        if (shapeType === 0) { // 圆形
            confetti.className = 'absolute';
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.borderRadius = '50%';
        } else if (shapeType === 1) { // 正方形
            confetti.className = 'absolute';
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
        } else { // 三角形
            confetti.className = 'absolute';
            confetti.style.width = '0';
            confetti.style.height = '0';
            confetti.style.borderLeft = `${size / 2}px solid transparent`;
            confetti.style.borderRight = `${size / 2}px solid transparent`;
            confetti.style.borderBottom = `${size}px solid currentColor`;
        }
        
        // 随机颜色和位置
        const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        confetti.style.backgroundColor = shapeType !== 2 ? color : 'transparent';
        confetti.style.color = color;
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.top = `-20px`;
        confetti.style.opacity = Math.random() * 0.8 + 0.2;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // 添加动画
        const animationDuration = Math.random() * 3 + 2;
        const animationDelay = Math.random() * 2;
        const horizontalOffset = (Math.random() - 0.5) * 100;
        
        confetti.style.animation = `falling ${animationDuration}s linear ${animationDelay}s forwards`;
        confetti.style.animationName = 'falling';
        
        confettiContainer.appendChild(confetti);
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes falling {
            0% {
                transform: translateY(0) translateX(0) rotate(0deg);
                opacity: 0.8;
            }
            50% {
                transform: translateY(50vh) translateX(100px) rotate(180deg);
                opacity: 0.5;
            }
            100% {
                transform: translateY(100vh) translateX(0) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 清除五彩纸屑效果
function clearConfetti() {
    const container = document.getElementById('confetti-container');
    if (container) {
        document.body.removeChild(container);
    }
    
    // 移除动画样式
    const styleElements = document.head.querySelectorAll('style');
    for (let i = 0; i < styleElements.length; i++) {
        if (styleElements[i].textContent.includes('@keyframes falling')) {
            document.head.removeChild(styleElements[i]);
            break;
        }
    }
}

// 荣誉墙功能可以后续扩展

// 显示操作记录弹窗
function showOperationLogs() {
    console.log('showOperationLogs called!');
    
    // 检查弹窗是否已存在
    let modal = document.getElementById('operation-logs-modal');
    
    if (!modal) {
        // 动态创建弹窗DOM结构
        modal = document.createElement('div');
        modal.id = 'operation-logs-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 mx-auto';
        modalContent.style.marginLeft = 'auto';
        modalContent.style.marginRight = 'auto';
        
        // 弹窗头部
        const modalHeader = document.createElement('div');
        modalHeader.className = 'p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl';
        
        const title = document.createElement('h3');
        title.className = 'text-xl font-bold text-gray-800 flex items-center';
        title.innerHTML = '<i class="fa fa-history mr-2 text-blue-500"></i>操作记录';
        
        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-operation-logs';
        closeBtn.className = 'w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400';
        closeBtn.innerHTML = '<i class="fa fa-times"></i>';
        // 确保事件监听器正确绑定
        closeBtn.onclick = function() {
            console.log('Close button clicked');
            hideOperationLogs();
        };
        
        modalHeader.appendChild(title);
        modalHeader.appendChild(closeBtn);
        
        // 记录列表区域 - 改进滚动体验
        const containerDiv = document.createElement('div');
        containerDiv.id = 'operation-logs-container';
        containerDiv.className = 'flex-1 overflow-y-auto p-4 bg-white flex justify-center';
        // 添加自定义滚动条样式
        containerDiv.style.scrollbarWidth = 'thin';
        containerDiv.style.scrollbarColor = '#c1c1c1 #f0f0f0';
        containerDiv.style.webkitOverflowScrolling = 'touch';
        
        const logsList = document.createElement('div');
        logsList.id = 'logs-list';
        logsList.className = 'space-y-4 w-full max-w-xl mx-auto';
        // 确保列表始终居中显示
        logsList.style.marginLeft = 'auto';
        logsList.style.marginRight = 'auto';
        
        containerDiv.appendChild(logsList);
        
        // 加载指示器
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'logs-loading';
        loadingDiv.className = 'py-6 text-center text-gray-500 hidden';
        loadingDiv.innerHTML = '<i class="fa fa-spinner fa-spin mr-2 text-blue-500"></i>加载中...';
        
        // 分页信息
        const paginationDiv = document.createElement('div');
        paginationDiv.id = 'logs-pagination';
        paginationDiv.className = 'p-4 border-t border-gray-100 text-center text-sm bg-gray-50 rounded-b-xl';
        paginationDiv.textContent = '共 0 条记录，第 1/1 页';
        
        // 组装弹窗
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(containerDiv);
        modalContent.appendChild(loadingDiv);
        modalContent.appendChild(paginationDiv);
        modal.appendChild(modalContent);
        
        // 添加到文档
        document.body.appendChild(modal);
        
        // 添加点击外部区域关闭功能
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideOperationLogs();
            }
        });
        
        // 添加ESC键关闭功能
        function handleEscKey(e) {
            if (e.key === 'Escape') {
                hideOperationLogs();
                document.removeEventListener('keydown', handleEscKey);
            }
        }
        document.addEventListener('keydown', handleEscKey);
    }
    
    // 重置分页状态
    currentLogsPage = 1;
    totalLogsPages = 1;
    hasMoreLogs = true;
    isLoadingLogs = false;
    
    // 清空列表
    const logsList = document.getElementById('logs-list');
    if (logsList) {
        logsList.innerHTML = '';
    }
    
    // 显示弹窗
    modal.style.display = 'flex';
    // 添加淡入动画
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
    
    // 加载第一页数据
    loadOperationLogs(currentLogsPage);
    
    // 添加滚动加载事件
    const container = document.getElementById('operation-logs-container');
    if (container) {
        // 先移除可能存在的事件监听
        container.removeEventListener('scroll', handleLogsScroll);
        // 添加新的事件监听
        container.addEventListener('scroll', handleLogsScroll);
    }
    
    // 确保弹窗在窗口大小改变时自适应
    function handleResize() {
        const modalContent = modal.querySelector('div');
        if (modalContent) {
            // 根据窗口大小调整最大高度
            const windowHeight = window.innerHeight;
            modalContent.style.maxHeight = `${windowHeight * 0.9}px`;
        }
    }
    
    // 初始调整
    handleResize();
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    
    // 保存resize事件监听器引用，以便在隐藏弹窗时移除
    modal._resizeListener = handleResize;
}

// 隐藏操作记录弹窗
function hideOperationLogs() {
    const modal = document.getElementById('operation-logs-modal');
    if (modal) {
        console.log('Hiding operation logs modal');
        
        // 添加淡出动画
        modal.style.opacity = '0';
        
        // 移除滚动事件监听
        const container = document.getElementById('operation-logs-container');
        if (container) {
            container.removeEventListener('scroll', handleLogsScroll);
        }
        
        // 移除窗口大小变化事件监听
        if (modal._resizeListener) {
            window.removeEventListener('resize', modal._resizeListener);
            modal._resizeListener = null;
        }
        
        // 移除ESC键事件监听
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                hideOperationLogs();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.removeEventListener('keydown', escHandler);
        
        // 移除点击外部区域关闭的事件监听
        const closeClickHandler = function(e) {
            if (e.target === modal) {
                hideOperationLogs();
                modal.removeEventListener('click', closeClickHandler);
            }
        };
        modal.removeEventListener('click', closeClickHandler);
        
        // 动画结束后完全隐藏
        setTimeout(() => {
            modal.style.display = 'none';
            // 确保z-index降低，避免影响其他元素
            modal.style.zIndex = '-1';
            // 确保document.body可以正常点击
            document.body.style.pointerEvents = '';
        }, 300);
    }
}

// 处理操作记录容器滚动事件
function handleLogsScroll() {
    const container = document.getElementById('operation-logs-container');
    if (container && !isLoadingLogs && hasMoreLogs) {
        // 当滚动到底部附近时，加载下一页
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            loadNextLogsPage();
        }
    }
}

// 加载下一页操作记录
function loadNextLogsPage() {
    if (currentLogsPage < totalLogsPages) {
        currentLogsPage++;
        loadOperationLogs(currentLogsPage);
    }
}

// 加载操作记录
async function loadOperationLogs(page) {
    if (isLoadingLogs || !hasMoreLogs) return;
    
    isLoadingLogs = true;
    const logsList = document.getElementById('logs-list');
    const loadingIndicator = document.getElementById('logs-loading');
    const paginationInfo = document.getElementById('logs-pagination');
    
    // 显示加载提示
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
    
    try {
        const response = await api.operationLogAPI.getOperationLogs(appState.currentUser.id, page, 10);
        
        if (response.success) {
            // 更新分页信息
            totalLogsPages = response.pages || 1;
            hasMoreLogs = page < totalLogsPages;
            
            // 更新分页显示
            if (paginationInfo) {
                paginationInfo.textContent = `共 ${response.total || 0} 条记录，第 ${page}/${totalLogsPages} 页`;
            }
            
            // 如果是第一页，清空列表
            if (page === 1) {
                logsList.innerHTML = '';
            }
            
            // 添加新记录
            if (response.data && response.data.length > 0) {
                response.data.forEach(log => {
                    const logItem = document.createElement('div');
                    logItem.className = 'p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors mx-auto w-full';
                    logItem.style.maxWidth = '100%';
                    
                    // 格式化时间
                    const formattedTime = formatDateTime(log.operation_time);
                    
                    // 创建记录内容 - 美化样式
                    logItem.innerHTML = `
                        <div class="flex flex-col p-1 mx-auto w-full" style="max-width: 100%;">
                            <div class="flex justify-between items-start w-full">
                                <p class="font-medium text-gray-800 flex items-center">
                                    <i class="fa ${getOperationIcon(log.operation_type)} mr-2 text-blue-500"></i>
                                    ${log.operation_type}
                                </p>
                                <span class="text-xs px-3 py-1 rounded-full font-medium ${log.operation_result === '成功' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} shadow-sm">
                                    ${log.operation_result}
                                </span>
                            </div>
                            <p class="text-gray-600 mt-2 text-sm leading-relaxed pl-6">${log.operation_content}</p>
                            <div class="flex justify-end mt-2">
                                <p class="text-gray-500 text-xs flex items-center">
                                    <i class="fa fa-clock-o mr-1"></i>${formattedTime}
                                </p>
                            </div>
                        </div>
                    `;
                    
                    logsList.appendChild(logItem);
                });
            } else if (page === 1) {
                // 没有记录时显示空状态
                logsList.innerHTML = '<div class="text-center py-10 text-gray-500">暂无操作记录</div>';
            }
        } else {
            domUtils.showToast(response.message || '获取操作记录失败', 'error');
        }
    } catch (error) {
        console.error('加载操作记录失败:', error);
        domUtils.showToast(`加载操作记录失败: ${error.message}`, 'error');
    } finally {
        // 隐藏加载提示
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
        isLoadingLogs = false;
    }
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

// 操作记录功能已实现

// 根据操作类型获取对应的图标
function getOperationIcon(operationType) {
    const iconMap = {
        '添加任务': 'fa-plus-circle',
        '更新任务': 'fa-pencil',
        '删除任务': 'fa-trash',
        '完成任务': 'fa-check-circle',
        '兑换心愿': 'fa-gift',
        '登录系统': 'fa-sign-in',
        '退出系统': 'fa-sign-out',
        '添加分类': 'fa-folder-plus',
        '删除分类': 'fa-folder-minus',
        '开始番茄钟': 'fa-clock-o',
        '完成番茄钟': 'fa-check-square-o'
    };
    
    return iconMap[operationType] || 'fa-cog';
}

// 显示荣誉墙弹窗
async function showHonorWall() {
    const honorWallModal = document.getElementById('honor-wall-modal');
    if (honorWallModal) {
        honorWallModal.classList.remove('hidden');
        // 渲染荣誉墙内容
        await renderHonorWall();
    }
}

// 隐藏荣誉墙弹窗
function hideHonorWall() {
    const honorWallModal = document.getElementById('honor-wall-modal');
    if (honorWallModal) {
        honorWallModal.classList.add('hidden');
    }
}

// 渲染荣誉墙内容
async function renderHonorWall() {
    try {
        const userHonors = await api.honorAPI.getUserHonors(appState.currentUser.id);
        const allHonors = await api.honorAPI.getAllHonors(appState.currentUser.id);
        
        const honorWallContent = document.getElementById('honor-wall-content');
        honorWallContent.innerHTML = '';
        
        // 保存荣誉数据到全局，用于筛选
        window.honorData = {
            userHonors: userHonors,
            allHonors: allHonors
        };
        
        // 创建用户荣誉的映射
        const userHonorMap = {};
        userHonors.forEach(honor => {
            userHonorMap[honor.id] = honor;
        });
        
        // 显示所有荣誉
        allHonors.forEach(honor => {
            renderSingleHonor(honor, userHonorMap[honor.id], honorWallContent);
        });
    } catch (error) {
        console.error('加载荣誉墙失败:', error);
        document.getElementById('honor-wall-content').innerHTML = 
            '<div class="col-span-full text-center text-gray-500 py-10">加载失败，请稍后再试</div>';
    }
}

// 渲染单个荣誉项
function renderSingleHonor(honor, userHonor, container) {
    const isObtained = !!userHonor;
    
    // 为不同类型的荣誉选择不同的背景色
    let bgColor = 'bg-yellow-100';
    let iconColor = 'text-yellow-500';
    let cardBg = 'bg-yellow-50';
    let borderColor = 'border-yellow-200';
    
    if (honor.name.includes('连续')) {
        bgColor = 'bg-blue-100';
        iconColor = 'text-blue-500';
        cardBg = 'bg-blue-50';
        borderColor = 'border-blue-200';
    } else if (honor.name.includes('第一个')) {
        bgColor = 'bg-pink-100';
        iconColor = 'text-pink-500';
        cardBg = 'bg-pink-50';
        borderColor = 'border-pink-200';
    } else if (honor.name.includes('学习')) {
        bgColor = 'bg-green-100';
        iconColor = 'text-green-500';
        cardBg = 'bg-green-50';
        borderColor = 'border-green-200';
    }
    
    const honorCard = document.createElement('div');
    // 优化卡片样式，使其更紧凑地适应移动设备的多列布局
    honorCard.className = `honor-card ${isObtained ? cardBg : 'bg-white'} rounded-lg border ${borderColor} p-2 transform transition-all duration-300 hover:scale-105 cursor-pointer w-full min-h-[150px] flex flex-col`;
    honorCard.dataset.obtained = isObtained;
    honorCard.innerHTML = `
        <div class="text-center flex flex-col items-center justify-between h-full">
            <!-- 减小图标容器大小 -->
            <div class="w-14 h-14 mx-auto ${isObtained ? bgColor : 'bg-gray-100'} rounded-full flex items-center justify-center mb-2 shadow-sm relative overflow-hidden">
                ${honor.icon ? `<img src="/static/images/honors/${honor.icon}" alt="${honor.name}" class="w-8 h-8 object-contain ${isObtained ? '' : 'opacity-50'}">` : `<i class="fa fa-trophy ${isObtained ? iconColor : 'text-gray-400'} text-xl"></i>`}
                <div class="absolute inset-0 bg-white opacity-20 rounded-full"></div>
                ${isObtained ? '<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-yellow-200">' +
                    `<span class="text-[10px] font-bold ${iconColor}">${userHonor.obtained_count}</span></div>` : ''}
            </div>
            <!-- 调整字体大小和间距 -->
            <h4 class="font-bold text-gray-800 mb-1 text-[11px]">${honor.name}</h4>
            <p class="text-gray-500 mb-1 text-[4px] line-clamp-2">${honor.description}</p>
            ${isObtained ? `<div class="text-[10px] text-gray-500 mt-auto">${userHonor.last_obtained.split(' ')[0]}</div>` : ''}
        </div>
    `;
    
    // 添加点击效果
    honorCard.addEventListener('click', () => {
        if (isObtained) {
            // 已获得的荣誉可以再次展示详情
            showHonorDetail(honor, userHonor);
        } else {
            // 未获得的荣誉显示获取条件提示
            domUtils.showToast(`完成以下条件可获得：${honor.condition || '继续努力'}`);
        }
    });
    
    container.appendChild(honorCard);
}

// 筛选荣誉
function filterHonors(filter) {
    const honorCards = document.querySelectorAll('.honor-card');
    
    honorCards.forEach(card => {
        const isObtained = card.dataset.obtained === 'true';
        
        if (filter === 'all') {
            card.classList.remove('hidden');
        } else if (filter === 'obtained' && isObtained) {
            card.classList.remove('hidden');
        } else if (filter === 'unobtained' && !isObtained) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

// 显示荣誉详情
function showHonorDetail(honor, userHonor) {
    // 可以扩展为显示更详细的荣誉信息弹窗
    domUtils.showToast(`${honor.name}\n${honor.description}\n获得次数：${userHonor.obtained_count}\n最后获得：${userHonor.last_obtained}`);
}

// 荣誉庆祝功能已在前面实现

// 隐藏庆祝弹窗
function hideCelebration() {
    const celebrationModal = document.getElementById('honor-celebration-modal');
    const celebrationContent = document.getElementById('celebration-content');
    
    if (celebrationModal && celebrationContent) {
        celebrationContent.classList.remove('scale-100', 'opacity-100');
        celebrationContent.classList.add('scale-90', 'opacity-0');
        
        setTimeout(() => {
            celebrationModal.classList.add('hidden');
            // 清理粒子
            const confetti = document.getElementById('confetti-container');
            if (confetti) confetti.remove();
        }, 300);
    }
}

// 创建庆祝粒子效果
function createCelebrationConfetti() {
    const container = document.createElement('div');
    container.id = 'confetti-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '60';
    document.body.appendChild(container);
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = Math.random() * 10 + 5 + 'px';
        confetti.style.height = Math.random() * 10 + 5 + 'px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = -20 + 'px';
        confetti.style.borderRadius = '2px';
        confetti.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
        confetti.style.opacity = Math.random() * 0.8 + 0.2;
        confetti.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        
        container.appendChild(confetti);
        
        // 动画
        const duration = Math.random() * 3 + 2;
        const start = performance.now();
        
        function animate(timestamp) {
            const elapsed = timestamp - start;
            const progress = elapsed / (duration * 1000);
            
            if (progress < 1) {
                confetti.style.top = progress * 100 + 'vh';
                confetti.style.left = Math.random() * 20 - 10 + parseInt(confetti.style.left) + 'px';
                confetti.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
                requestAnimationFrame(animate);
            } else {
                confetti.remove();
            }
        }
        
        requestAnimationFrame(animate);
    }
}

// 显示金币设置模态窗口
async function showGoldSettingsModal() {
    try {
        // 获取最新的用户信息，确保金币数量是最新的
        const userInfo = await api.userAPI.getUserInfo(appState.currentUser.id);
        if (userInfo.user) {
            // 更新appState中的用户信息
            appState.currentUser = { ...appState.currentUser, ...userInfo.user };
            // 显示最新的金币数量
            document.getElementById('current-gold-display').textContent = userInfo.user.total_gold || 0;
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
        // 如果获取失败，使用本地缓存的数据
        if (appState.currentUser) {
            document.getElementById('current-gold-display').textContent = appState.currentUser.total_gold || 0;
        }
    }
    
    // 清空输入框
    document.getElementById('new-gold-input').value = '';
    document.getElementById('gold-reason-input').value = '';
    
    // 显示模态窗口
    document.getElementById('gold-settings-modal').classList.remove('hidden');
}

// 隐藏金币设置模态窗口
function hideGoldSettingsModal() {
    document.getElementById('gold-settings-modal').classList.add('hidden');
}

// 保存金币设置
async function saveGoldSettings() {
    const newGold = document.getElementById('new-gold-input').value.trim();
    const reason = document.getElementById('gold-reason-input').value.trim();
    
    // 验证输入
    if (!newGold || isNaN(newGold) || parseInt(newGold) < 0) {
        domUtils.showToast('请输入有效的金币数量', 'error');
        return;
    }
    
    if (!reason || reason.length < 2) {
        domUtils.showToast('修改原因至少需要2个字符', 'error');
        return;
    }
    
    try {
        // 调用API更新金币数量
        const response = await api.userAPI.updateUserGold({
            user_id: appState.currentUser.id,
            gold: parseInt(newGold),
            reason: reason
        });
        
        if (response.success) {
            // 更新本地用户信息
            appState.currentUser.total_gold = parseInt(newGold);
            storageUtils.saveUser(appState.currentUser);
            
            // 更新界面显示
            document.getElementById('current-gold-display').textContent = newGold;
            updateUserInfo(); // 更新用户信息显示
            
            // 显示成功提示
            domUtils.showToast('金币数量更新成功', 'success');
            
            // 隐藏模态窗口
            hideGoldSettingsModal();
        } else {
            domUtils.showToast(response.message || '更新失败', 'error');
        }
    } catch (error) {
        console.error('更新金币数量失败:', error);
        domUtils.showToast('网络错误，请稍后重试', 'error');
    }
}

// 添加金币设置和关于页面相关的事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 金币设置事件
    document.getElementById('gold-settings-btn')?.addEventListener('click', showGoldSettingsModal);
    document.getElementById('close-gold-settings')?.addEventListener('click', hideGoldSettingsModal);
    document.getElementById('cancel-gold-settings')?.addEventListener('click', hideGoldSettingsModal);
    document.getElementById('save-gold-settings')?.addEventListener('click', saveGoldSettings);
    
    // 关于页面事件
    document.getElementById('about-btn')?.addEventListener('click', showAboutModal);
    document.getElementById('close-about-modal')?.addEventListener('click', hideAboutModal);
    document.getElementById('xiaohongshu-btn')?.addEventListener('click', handleXiaohongshuClick);
    
    // 邮件联系按钮事件
    document.getElementById('email-btn')?.addEventListener('click', function() {
        const email = this.getAttribute('data-email');
        if (email) {
            window.location.href = `mailto:${email}`;
        }
    });
    
    // 点击模态窗口背景关闭
    document.getElementById('about-modal')?.addEventListener('click', function(event) {
        if (event.target === this) {
            hideAboutModal();
        }
    });
});

// 显示关于模态窗口
async function showAboutModal() {
    try {
        // 读取配置文件获取版本号、描述和联系邮箱
        const response = await fetch('static/config/config.json');
        const config = await response.json();
        
        // 更新版本号显示
        if (config.version) {
            document.getElementById('app-version').textContent = `版本 ${config.version}`;
        }
        
        // 更新描述显示
        if (config.description) {
            document.getElementById('app-description').textContent = config.description;
        }
        
        // 更新联系邮箱
        if (config.contactEmail) {
            document.getElementById('email-btn').textContent = '邮件联系';
            // 存储邮箱地址供点击事件使用
            document.getElementById('email-btn').setAttribute('data-email', config.contactEmail);
        }
        
        // 存储小红书链接用于后续使用
        if (config.xiaohongshuUrl) {
            document.getElementById('xiaohongshu-btn').setAttribute('data-url', config.xiaohongshuUrl);
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
        // 使用默认版本号
        document.getElementById('app-version').textContent = '版本 1.0.0';
        // 使用默认描述
        document.getElementById('app-description').textContent = '帮助学生培养良好的学习习惯和时间管理能力';
        // 使用默认邮箱
        document.getElementById('email-btn').textContent = '邮件联系';
        document.getElementById('email-btn').setAttribute('data-email', 'support@homerecord.com');
    }
    
    // 显示模态窗口
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.classList.remove('hidden');
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

// 隐藏关于模态窗口
function hideAboutModal() {
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.classList.add('hidden');
        // 恢复背景滚动
        document.body.style.overflow = 'auto';
    }
}

// 处理小红书按钮点击
function handleXiaohongshuClick() {
    const url = this.getAttribute('data-url') || 'https://www.xiaohongshu.com';
    // 在新窗口打开链接
    window.open(url, '_blank');
}

// 启动应用
initApp();