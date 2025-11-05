// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/service-worker.js')
      .then(reg => {
        console.log('Service Worker 注册成功:', reg.scope);
      })
      .catch(err => {
        console.warn('Service Worker 注册失败:', err);
      });
  });
}

// 安装提示事件占位（可根据需要展示自定义提示）
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});