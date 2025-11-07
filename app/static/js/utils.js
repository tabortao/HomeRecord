// 日期工具函数
const dateUtils = {
    // 获取当前日期的字符串格式 YYYY-MM-DD
    getCurrentDate: () => {
        const date = new Date();
        return date.toISOString().split('T')[0];
    },

    // 格式化日期显示
    formatDate: (dateString) => {
        const date = new Date(dateString);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}/${day}`;
    },

    // 获取本周的日期数组
    getWeekDates: (dateString) => {
        const date = dateString ? new Date(dateString) : new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 调整到本周一
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(date);
            currentDate.setDate(diff + i);
            weekDates.push({
                date: currentDate.toISOString().split('T')[0],
                day: currentDate.getDate(),
                isToday: currentDate.toDateString() === new Date().toDateString()
            });
        }
        
        return weekDates;
    },

    // 获取周信息显示
    getWeekInfo: (dateString) => {
        const date = dateString ? new Date(dateString) : new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // 计算第几周
        const firstDay = new Date(year, 0, 1);
        const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000)) + 1;
        const weekNumber = Math.ceil(days / 7);
        
        return `${year}年${month}月第${weekNumber}周`;
    },

    // 获取上一周的开始日期
    getPrevWeekStart: (dateString) => {
        const date = dateString ? new Date(dateString) : new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 调整到本周一
        const prevWeekStart = new Date(date);
        prevWeekStart.setDate(diff - 7);
        return prevWeekStart.toISOString().split('T')[0];
    },

    // 获取下一周的开始日期
    getNextWeekStart: (dateString) => {
        const date = dateString ? new Date(dateString) : new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 调整到本周一
        const nextWeekStart = new Date(date);
        nextWeekStart.setDate(diff + 7);
        return nextWeekStart.toISOString().split('T')[0];
    }
};

// 时间工具函数
const timeUtils = {
    // 格式化分钟显示
    formatMinutes: (minutes) => {
        if (minutes < 60) {
            return `${minutes}分钟`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
        }
    },

    // 格式化番茄钟时间
    formatTomatoTime: (minutes) => {
        const mins = Math.floor(minutes % 60).toString().padStart(2, '0');
        const totalMinutes = Math.floor(minutes);
        const formatted = totalMinutes >= 60 
            ? `${Math.floor(totalMinutes / 60)}:${mins}`
            : `0:${mins}`;
        return formatted;
    }
};

// 存储工具函数
const storageUtils = {
    // 保存用户信息到本地存储
    saveUser: (userInfo) => {
        localStorage.setItem('user', JSON.stringify(userInfo));
    },

    // 获取本地存储的用户信息
    getUser: () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    // 清除本地存储的用户信息
    clearUser: () => {
        localStorage.removeItem('user');
    },

    // 保存设置到本地存储
    saveSettings: (settings) => {
        localStorage.setItem('settings', JSON.stringify(settings));
    },

    // 获取本地存储的设置
    getSettings: () => {
        const settingsStr = localStorage.getItem('settings');
        return settingsStr ? JSON.parse(settingsStr) : {};
    }
};

// DOM工具函数
const domUtils = {
    // 仅应用一次自适应高度计算（供页面显示后或内容变动后手动调用）
    applyAdaptiveHeight: () => {
        const viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        const appEl = document.getElementById('app');
        const contentEl = document.getElementById('content');
        const headerEl = document.getElementById('page-header');
        const statsEl = document.getElementById('statistics-bar');
        const bottomNavEl = document.getElementById('bottom-nav');

        if (appEl) {
            appEl.style.height = `${viewportHeight}px`;
            appEl.style.transition = 'height 0.2s ease';
        }

        if (contentEl) {
            const topSectionHeight = (headerEl ? headerEl.offsetHeight : 0) + (statsEl ? statsEl.offsetHeight : 0);
            const bottomNavHeight = bottomNavEl && !bottomNavEl.classList.contains('hidden') ? bottomNavEl.offsetHeight : 0;
            const style = window.getComputedStyle(contentEl);
            const paddingTop = parseFloat(style.paddingTop) || 0;
            const paddingBottom = parseFloat(style.paddingBottom) || 0;
            const extraGap = 4;
            const maxContentHeight = viewportHeight - topSectionHeight - bottomNavHeight - paddingTop - paddingBottom - extraGap;
            if (maxContentHeight > 0) {
                const h = Math.floor(maxContentHeight);
                contentEl.style.maxHeight = `${h}px`;
                contentEl.style.height = `${h}px`;
                contentEl.style.transition = 'max-height 0.2s ease, height 0.2s ease';
                contentEl.style.overflowY = 'auto';
            }
        }
    },

    // 初始化并绑定自适应高度监听（支持移动浏览器地址栏动态变化）
    initAdaptiveHeight: () => {
        // 避免重复绑定事件监听
        if (window.__adaptiveHeightInitialized) {
            try { domUtils.applyAdaptiveHeight(); } catch {}
            return;
        }
        window.__adaptiveHeightInitialized = true;

        // 首次应用
        try { domUtils.applyAdaptiveHeight(); } catch {}

        // 在窗口大小变化与设备旋转时更新
        let rafId = null;
        const schedule = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                try { domUtils.applyAdaptiveHeight(); } catch {}
                rafId = null;
            });
        };

        window.addEventListener('resize', schedule, { passive: true });
        window.addEventListener('orientationchange', schedule, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', schedule, { passive: true });
            window.visualViewport.addEventListener('scroll', schedule, { passive: true });
        }
    },
    // 显示消息提示
    showToast: (message, type = 'success') => {
        // 移除已存在的toast
        const existingToast = document.querySelector('.toast-message');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast-message fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg z-50 transition-opacity duration-300 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 2秒后自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 2000);
    },

    // 显示确认对话框
    showConfirm: (title, message, onConfirm, onCancel, okText = '确定', cancelText = '取消') => {
        // 移除已存在的confirm
        const existingConfirm = document.querySelector('.confirm-dialog');
        if (existingConfirm) {
            existingConfirm.remove();
        }

        const confirmHtml = `
            <div class="confirm-dialog fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300">
                <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl transform transition-transform duration-300">
                    <div class="text-center mb-4">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">${title}</h3>
                        <p class="text-gray-600">${message}</p>
                    </div>
                    <div class="flex space-x-4">
                        <button class="confirm-cancel flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200">${cancelText}</button>
                        <button class="confirm-ok flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-400">${okText}</button>
                    </div>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = confirmHtml;
        const confirmDialog = tempDiv.firstElementChild;
        
        document.body.appendChild(confirmDialog);
        
        // 添加淡入动画效果
        setTimeout(() => {
            confirmDialog.style.opacity = '1';
            confirmDialog.querySelector('.bg-white').style.transform = 'scale(1)';
        }, 10);
        
        // 绑定事件
        const cancelBtn = confirmDialog.querySelector('.confirm-cancel');
        const okBtn = confirmDialog.querySelector('.confirm-ok');
        
        cancelBtn.addEventListener('click', () => {
            confirmDialog.style.opacity = '0';
            confirmDialog.querySelector('.bg-white').style.transform = 'scale(0.95)';
            setTimeout(() => {
                confirmDialog.remove();
                if (onCancel) onCancel();
            }, 200);
        });
        
        okBtn.addEventListener('click', () => {
            confirmDialog.style.opacity = '0';
            confirmDialog.querySelector('.bg-white').style.transform = 'scale(0.95)';
            setTimeout(() => {
                confirmDialog.remove();
                if (onConfirm) onConfirm();
            }, 200);
        });
        
        // 点击背景关闭（可选）
        confirmDialog.addEventListener('click', (e) => {
            if (e.target === confirmDialog) {
                cancelBtn.click();
            }
        });
    },

    // 显示输入对话框
    showPrompt: (title, message, defaultValue = '', onConfirm, onCancel) => {
        // 移除已存在的prompt
        const existingPrompt = document.querySelector('.prompt-dialog');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        const promptHtml = `
            <div class="prompt-dialog fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg w-full max-w-sm p-6">
                    <h3 class="text-lg font-bold text-gray-800 mb-2">${title}</h3>
                    <p class="text-gray-600 mb-4">${message}</p>
                    <input type="text" class="prompt-input w-full px-4 py-2 border border-gray-300 rounded-lg mb-4" value="${defaultValue}">
                    <div class="flex space-x-4">
                        <button class="prompt-cancel flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700">取消</button>
                        <button class="prompt-ok flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">确定</button>
                    </div>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = promptHtml;
        const promptDialog = tempDiv.firstElementChild;
        
        document.body.appendChild(promptDialog);
        
        // 聚焦输入框
        const input = promptDialog.querySelector('.prompt-input');
        input.focus();
        input.select();
        
        // 绑定事件
        promptDialog.querySelector('.prompt-cancel').addEventListener('click', () => {
            promptDialog.remove();
            if (onCancel) onCancel();
        });
        
        promptDialog.querySelector('.prompt-ok').addEventListener('click', () => {
            const value = input.value;
            promptDialog.remove();
            if (onConfirm) onConfirm(value);
        });
    }
};

// 颜色工具函数
const colorUtils = {
    // 获取任务分类对应的颜色
    getCategoryColor: (categoryName) => {
        // 首先检查全局taskTabsManager中的动态学科列表
        if (window.taskTabsManager && window.taskTabsManager.categories && window.taskTabsManager.categories.length > 0) {
            const category = window.taskTabsManager.categories.find(cat => cat.name === categoryName);
            if (category && category.color) {
                return category.color;
            }
        }
        
        // 如果动态列表中没有找到，使用默认颜色映射
        const defaultCategoryColors = {
            '语文': '#FF6B6B',
            '数学': '#4ECDC4',
            '英语': '#45B7D1',
            '劳动': '#96CEB4',
            '生活': '#FFEAA7',
            '兴趣': '#DDA0DD',
            '表扬': '#77DD77',
            '批评': '#FF6347',
            '独立': '#87CEEB',
            '惩罚': '#FFA07A'
        };
        
        return defaultCategoryColors[categoryName] || '#999999';
    }
};

// 统一导出
export { dateUtils, timeUtils, storageUtils, domUtils, colorUtils };