// 下拉刷新模块：为主内容区域添加移动端友好的下拉刷新
import { domUtils } from './utils.js';

const STATE = {
  startY: 0,
  pulling: false,
  lastDelta: 0,
  threshold: 70,
  indicator: null,
};

function ensureIndicator(container) {
  if (STATE.indicator) return STATE.indicator;
  const indicator = document.createElement('div');
  indicator.id = 'pull-refresh-indicator';
  indicator.style.position = 'absolute';
  indicator.style.left = '0';
  indicator.style.right = '0';
  indicator.style.top = '0';
  indicator.style.height = '50px';
  indicator.style.display = 'flex';
  indicator.style.alignItems = 'center';
  indicator.style.justifyContent = 'center';
  indicator.style.fontSize = '14px';
  indicator.style.color = '#6b7280';
  indicator.style.transform = 'translateY(-60px)';
  indicator.style.transition = 'transform 150ms ease';
  indicator.style.zIndex = '20';
  indicator.style.pointerEvents = 'none';
  indicator.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.75))';
  indicator.textContent = '下拉刷新';
  container.parentNode.insertBefore(indicator, container);
  STATE.indicator = indicator;
  return indicator;
}

function removeIndicator() {
  if (STATE.indicator) {
    STATE.indicator.remove();
    STATE.indicator = null;
  }
}

async function performRefresh() {
  const page = (window.appState && window.appState.currentPage) || 'task';
  try {
    domUtils.showToast('正在刷新...');
    if (page === 'task' && typeof window.loadTasks === 'function') {
      await window.loadTasks();
    } else if (page === 'wish' && typeof window.loadWishes === 'function') {
      await window.loadWishes();
    } else if (page === 'profile' && typeof window.updateUserInfo === 'function') {
      await window.updateUserInfo();
    }
    domUtils.showToast('刷新完成');
  } catch (e) {
    console.error('下拉刷新失败:', e);
    domUtils.showToast('刷新失败，请稍后重试', 'error');
  }
}

function attachPullToRefresh(content) {
  if (!content) return;

  // 提升移动端滚动体验
  content.style.webkitOverflowScrolling = 'touch';
  content.style.overflowY = content.style.overflowY || 'auto';

  content.addEventListener('touchstart', (e) => {
    if (content.scrollTop > 0) {
      STATE.pulling = false;
      return;
    }
    STATE.startY = e.touches[0].clientY;
    STATE.pulling = true;
    STATE.lastDelta = 0;
    ensureIndicator(content);
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if (!STATE.pulling) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - STATE.startY;
    if (delta <= 0) return;
    STATE.lastDelta = delta;
    const translate = Math.min(100, Math.round(delta / 2));
    content.style.transform = `translateY(${translate}px)`;
    if (STATE.indicator) {
      STATE.indicator.textContent = translate > STATE.threshold / 2 ? '释放刷新' : '下拉刷新';
      STATE.indicator.style.transform = `translateY(${Math.min(translate - 10, 40)}px)`;
    }
  }, { passive: true });

  const resetTransform = () => {
    content.style.transition = 'transform 200ms ease';
    content.style.transform = 'translateY(0)';
    setTimeout(() => {
      content.style.transition = '';
    }, 220);
  };

  content.addEventListener('touchend', async () => {
    if (!STATE.pulling) return;
    const shouldRefresh = STATE.lastDelta > STATE.threshold;
    resetTransform();
    removeIndicator();
    STATE.pulling = false;
    STATE.lastDelta = 0;
    if (shouldRefresh) {
      await performRefresh();
    }
  });
}

function initPullToRefresh() {
  const content = document.getElementById('content');
  if (content) {
    attachPullToRefresh(content);
  }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', initPullToRefresh);

export { initPullToRefresh };