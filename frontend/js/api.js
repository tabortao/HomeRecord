// API基础URL
const API_BASE_URL = 'http://localhost:5000/api';

// 用户相关API
const userAPI = {
    // 用户登录
    login: async (username, password) => {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    },

    // 用户注册
    register: async (username, password) => {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    },

    // 获取用户信息
    getUserInfo: async (userId) => {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        return await response.json();
    },
    
    // 更新用户信息
    updateUserInfo: async (userId, userData) => {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        return await response.json();
    },
    
    // 上传头像
    uploadAvatar: async (userId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    }
};

// 任务相关API
const taskAPI = {
    // 获取任务列表
    getTasks: async (userId, date, category) => {
        let url = `${API_BASE_URL}/tasks?user_id=${userId}`;
        if (date) url += `&date=${date}`;
        if (category && category !== '全部学科') url += `&category=${category}`;
        
        const response = await fetch(url);
        return await response.json();
    },

    // 添加任务
    addTask: async (taskData) => {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        return await response.json();
    },

    // 更新任务
    updateTask: async (taskId, taskData) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        return await response.json();
    },

    // 删除任务
    deleteTask: async (taskId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        return await response.json();
    }
};

// 分类相关API
const categoryAPI = {
    // 获取分类列表
    getCategories: async (userId) => {
        const response = await fetch(`${API_BASE_URL}/categories?user_id=${userId}`);
        return await response.json();
    },

    // 添加分类
    addCategory: async (categoryData) => {
        const response = await fetch(`${API_BASE_URL}/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });
        return await response.json();
    },

    // 删除分类
    deleteCategory: async (categoryId) => {
        const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
            method: 'DELETE'
        });
        return await response.json();
    }
};

// 心愿相关API
const wishAPI = {
    // 获取心愿列表
    getWishes: async (userId) => {
        const response = await fetch(`${API_BASE_URL}/wishes?user_id=${userId}`);
        return await response.json();
    },

    // 添加心愿
    addWish: async (wishData) => {
        const response = await fetch(`${API_BASE_URL}/wishes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(wishData)
        });
        return await response.json();
    },

    // 更新心愿
    updateWish: async (wishId, wishData) => {
        const response = await fetch(`${API_BASE_URL}/wishes/${wishId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(wishData)
        });
        return await response.json();
    },

    // 删除心愿
    deleteWish: async (wishId) => {
        const response = await fetch(`${API_BASE_URL}/wishes/${wishId}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // 兑换心愿
    exchangeWish: async (wishId, userId) => {
        const response = await fetch(`${API_BASE_URL}/wishes/exchange/${wishId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        return await response.json();
    },

    // 获取兑换记录
    getExchangeHistory: async (userId, page = 1, perPage = 10) => {
        try {
            const response = await fetch(`${API_BASE_URL}/exchange-history?user_id=${userId}&page=${page}&per_page=${perPage}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return await response.json();
        } catch (error) {
            console.error('获取兑换记录失败:', error);
            return { success: false, message: '获取记录失败，请稍后重试' };
        }
    }
};

// 金币相关API
const goldAPI = {
    // 更新金币
    updateGold: async (userId, amount, reason) => {
        const response = await fetch(`${API_BASE_URL}/gold/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId, amount, reason })
        });
        return await response.json();
    }
};

// 统计相关API
const statisticsAPI = {
    // 获取统计数据
    getStatistics: async (userId, date) => {
        const response = await fetch(`${API_BASE_URL}/statistics?user_id=${userId}&date=${date}`);
        return await response.json();
    }
};

// 操作记录API
const logAPI = {
    // 获取操作记录
    getLogs: async (userId) => {
        const response = await fetch(`${API_BASE_URL}/logs?user_id=${userId}`);
        return await response.json();
    }
};

// 荣誉相关API
const honorAPI = {
    // 获取用户荣誉
    getUserHonors: async (userId) => {
        const response = await fetch(`${API_BASE_URL}/honors/user/${userId}`);
        return await response.json();
    },

    // 获取所有荣誉
    getAllHonors: async () => {
        const response = await fetch(`${API_BASE_URL}/honors/all`);
        return await response.json();
    }
};

// 导出API
const api = {
    userAPI,
    taskAPI,
    categoryAPI,
    wishAPI,
    goldAPI,
    statisticsAPI,
    logAPI,
    honorAPI
};

// 支持默认导出和命名导出
export default api;
export { userAPI, taskAPI, categoryAPI, wishAPI, goldAPI, statisticsAPI, logAPI, honorAPI };