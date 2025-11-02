// API基础URL，优先从环境变量获取，否则使用默认值
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

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
    },
    
    // 更新用户金币数量
    updateUserGold: async (data) => {
        const response = await fetch(`${API_BASE_URL}/users/${data.user_id}/gold`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gold: data.gold, reason: data.reason })
        });
        return await response.json();
    }
};

// 子账号管理API
const subaccountAPI = {
    // 创建子账号
    createSubaccount: async (parentId, subaccountData) => {
        const response = await fetch(`${API_BASE_URL}/users/${parentId}/subaccounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subaccountData)
        });
        return await response.json();
    },
    
    // 获取子账号列表
    getSubaccounts: async (parentId) => {
        const response = await fetch(`${API_BASE_URL}/users/${parentId}/subaccounts`);
        return await response.json();
    },
    
    // 删除子账号
    deleteSubaccount: async (parentId, subaccountId) => {
        const response = await fetch(`${API_BASE_URL}/users/${parentId}/subaccounts/${subaccountId}`, {
            method: 'DELETE'
        });
        return await response.json();
    },
    
    // 验证用户名是否可用
    checkUsernameAvailable: async (username) => {
        const response = await fetch(`${API_BASE_URL}/check-username?username=${encodeURIComponent(username)}`);
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
        
        console.log('请求任务列表URL:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        console.log('响应类型:', response.type);
        
        if (!response.ok) {
            throw new Error(`API请求失败，状态码: ${response.status}`);
        }
        
        // 确保响应不为空
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('响应不是有效的JSON格式');
        }
        
        try {
            const data = await response.json();
            console.log('获取到的任务数据:', data);
            return data;
        } catch (jsonError) {
            console.error('JSON解析错误:', jsonError);
            // 尝试获取原始响应文本以便调试
            const text = await response.text();
            console.error('原始响应内容:', text);
            throw new Error(`JSON解析失败: ${jsonError.message}`);
        }
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
    
    // 批量添加任务
    addTasksBatch: async (tasksData, userId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tasks: tasksData,
                user_id: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`批量添加任务API调用失败，状态码: ${response.status}`);
        }
        
        return await response.json();
    },

    // 更新任务
    updateTask: async (taskId, taskData, currentUserId) => {
        // 构建URL，添加current_user_id查询参数
        let url = `${API_BASE_URL}/tasks/${taskId}`;
        if (currentUserId) {
            url += `?current_user_id=${currentUserId}`;
        }
        
        const response = await fetch(url, {
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
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json' // 添加Content-Type头
            }
        });
        
        if (!response.ok) {
            // 尝试获取错误响应的JSON内容
            try {
                const errorData = await response.json();
                throw new Error(errorData.message || `服务器响应错误: ${response.status}`);
            } catch (jsonError) {
                // 如果无法解析JSON，使用默认错误消息
                throw new Error(`服务器响应错误: ${response.status}`);
            }
        }
        
        return await response.json();
    },
    
    // 上传任务图片
    uploadTaskImages: async (taskId, files) => {
        // 由于后端API只支持单个文件上传，我们需要循环上传每个文件
        const uploadedImages = [];
        
        for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            // 根据后端api.py中的要求，字段名应为'file'
            formData.append('file', files[i]);
            
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                if (result.success && result.image_url) {
                    uploadedImages.push(result.image_url);
                }
            } catch (error) {
                console.error('上传图片失败:', error);
            }
        }
        
        return {
            success: uploadedImages.length > 0,
            image_url: uploadedImages[0], // 保持向后兼容
            image_urls: uploadedImages    // 返回所有上传的图片URL
        };
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

    // 更新分类
    updateCategory: async (categoryId, categoryData) => {
        const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
            method: 'PUT',
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

    // 上传心愿图片
    uploadWishImage: async (userId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/wishes/upload?user_id=${userId}`, {
            method: 'POST',
            body: formData
        });
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
    exchangeWish: async (wishId, userId, quantity = 1) => {
        const response = await fetch(`${API_BASE_URL}/wishes/exchange/${wishId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userId, 
                quantity: quantity 
            })
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

// 操作记录相关API
const operationLogAPI = {
    // 获取操作记录
    getOperationLogs: async (userId, page = 1, perPage = 10, startTime = null, endTime = null) => {
        let url = `${API_BASE_URL}/logs?user_id=${userId}&page=${page}&per_page=${perPage}`;
        if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
        if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
        const response = await fetch(url);
        return await response.json();
    }
};

// 荣誉相关API
const honorAPI = {
    // 获取所有荣誉（包含用户状态）
    getAllHonors: async (userId) => {
        try {
            console.log('===== 获取所有荣誉开始 =====');
            console.log('获取所有荣誉，用户ID类型:', typeof userId);
            console.log('获取所有荣誉，用户ID值:', userId);
            
            // 验证用户ID
            if (!userId || userId === undefined || userId === null || userId === '') {
                const error = new Error('无效的用户ID');
                console.error('错误:', error);
                throw error;
            }
            
            const url = `${API_BASE_URL}/honors/all?user_id=${userId}`;
            console.log('请求URL:', url);
            
            // 添加fetch超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                console.log('获取所有荣誉请求状态:', response.status);
                
                if (!response.ok) {
                    // 尝试获取错误响应
                    try {
                        const errorData = await response.json();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 消息: ${errorData.message || '未知错误'}`);
                        console.error('错误响应数据:', errorData);
                        throw error;
                    } catch (jsonError) {
                        // 如果无法解析JSON，获取原始文本
                        const text = await response.text();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 响应: ${text}`);
                        console.error('无法解析JSON响应:', jsonError);
                        console.error('原始响应文本:', text);
                        throw error;
                    }
                }
                
                // 验证响应内容
                try {
                    const data = await response.json();
                    console.log('获取所有荣誉响应数据类型:', typeof data);
                    console.log('获取所有荣誉响应数据:', data);
                    return data;
                } catch (jsonError) {
                    const text = await response.text();
                    const error = new Error(`JSON解析失败: ${jsonError.message}`);
                    console.error('JSON解析错误:', jsonError);
                    console.error('原始响应文本:', text);
                    throw error;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    const error = new Error('获取所有荣誉请求超时');
                    console.error('超时错误:', error);
                    throw error;
                }
                
                const error = new Error(`网络请求失败: ${fetchError.message}`);
                console.error('网络请求错误:', fetchError);
                throw error;
            }
        } catch (error) {
            console.error('获取所有荣誉整体失败:', error);
            // 重新抛出错误以便上层函数处理
            throw error;
        } finally {
            console.log('===== 获取所有荣誉结束 =====');
        }
    },
    
    // 获取用户荣誉
    getUserHonors: async (userId) => {
        try {
            console.log('===== 获取用户荣誉开始 =====');
            console.log('获取用户荣誉，用户ID类型:', typeof userId);
            console.log('获取用户荣誉，用户ID值:', userId);
            
            // 验证用户ID
            if (!userId || userId === undefined || userId === null || userId === '') {
                const error = new Error('无效的用户ID');
                console.error('错误:', error);
                throw error;
            }
            
            const url = `${API_BASE_URL}/honors/user/${userId}`;
            console.log('请求URL:', url);
            
            // 添加fetch超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                console.log('获取用户荣誉请求状态:', response.status);
                
                if (!response.ok) {
                    // 尝试获取错误响应
                    try {
                        const errorData = await response.json();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 消息: ${errorData.message || '未知错误'}`);
                        console.error('错误响应数据:', errorData);
                        throw error;
                    } catch (jsonError) {
                        // 如果无法解析JSON，获取原始文本
                        const text = await response.text();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 响应: ${text}`);
                        console.error('无法解析JSON响应:', jsonError);
                        console.error('原始响应文本:', text);
                        throw error;
                    }
                }
                
                // 验证响应内容
                try {
                    const data = await response.json();
                    console.log('获取用户荣誉响应数据类型:', typeof data);
                    console.log('获取用户荣誉响应数据:', data);
                    return data;
                } catch (jsonError) {
                    const text = await response.text();
                    const error = new Error(`JSON解析失败: ${jsonError.message}`);
                    console.error('JSON解析错误:', jsonError);
                    console.error('原始响应文本:', text);
                    throw error;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    const error = new Error('获取用户荣誉请求超时');
                    console.error('超时错误:', error);
                    throw error;
                }
                
                const error = new Error(`网络请求失败: ${fetchError.message}`);
                console.error('网络请求错误:', fetchError);
                throw error;
            }
        } catch (error) {
            console.error('获取用户荣誉整体失败:', error);
            // 重新抛出错误以便上层函数处理
            throw error;
        } finally {
            console.log('===== 获取用户荣誉结束 =====');
        }
    },
    
    // 检查并授予新荣誉
    checkAndGrantHonors: async (userId) => {
        try {
            console.log('===== 荣誉检查开始 =====');
            console.log('发送荣誉检查请求，用户ID类型:', typeof userId);
            console.log('发送荣誉检查请求，用户ID值:', userId);
            
            // 验证用户ID
            if (!userId || userId === undefined || userId === null || userId === '') {
                const error = new Error('无效的用户ID');
                console.error('错误:', error);
                throw error;
            }
            
            const url = `${API_BASE_URL}/honors/check`;
            console.log('请求URL:', url);
            
            // 添加fetch超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user_id: userId }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                console.log('荣誉检查请求状态:', response.status);
                
                if (!response.ok) {
                    // 尝试获取错误响应
                    try {
                        const errorData = await response.json();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 消息: ${errorData.message || '未知错误'}`);
                        console.error('错误响应数据:', errorData);
                        throw error;
                    } catch (jsonError) {
                        // 如果无法解析JSON，获取原始文本
                        const text = await response.text();
                        const error = new Error(`HTTP错误! 状态: ${response.status}, 响应: ${text}`);
                        console.error('无法解析JSON响应:', jsonError);
                        console.error('原始响应文本:', text);
                        throw error;
                    }
                }
                
                // 验证响应内容
                try {
                    const data = await response.json();
                    console.log('荣誉检查响应数据类型:', typeof data);
                    console.log('荣誉检查响应数据:', data);
                    return data;
                } catch (jsonError) {
                    const text = await response.text();
                    const error = new Error(`JSON解析失败: ${jsonError.message}`);
                    console.error('JSON解析错误:', jsonError);
                    console.error('原始响应文本:', text);
                    throw error;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    const error = new Error('荣誉检查请求超时');
                    console.error('超时错误:', error);
                    throw error;
                }
                
                const error = new Error(`网络请求失败: ${fetchError.message}`);
                console.error('网络请求错误:', fetchError);
                throw error;
            }
        } catch (error) {
            console.error('荣誉检查整体失败:', error);
            // 重新抛出错误以便上层函数处理
            throw error;
        } finally {
            console.log('===== 荣誉检查结束 =====');
        }
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
    operationLogAPI,
    honorAPI,
    subaccountAPI
};

// 支持默认导出和命名导出
export default api;
export { userAPI, taskAPI, categoryAPI, wishAPI, goldAPI, statisticsAPI, operationLogAPI, honorAPI, subaccountAPI };