// 备注弹窗组件
// 功能：列表、添加、回复、删除、上传图片与音频
// 依赖：api.js 中的 remarkAPI, domUtils.tryParseJSON 如果存在

import api, { remarkAPI } from './api.js';
import { domUtils } from './utils.js';

(function() {
  // 录音状态
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedBlob = null;
  const modalId = 'remarks-modal';

  function createModal() {
    let existing = document.getElementById(modalId);
    if (existing) return existing;
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50';
    // 防止被页面其他高 z-index 元素遮挡
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
      <div class="bg-white w-11/12 max-w-2xl max-h-[90vh] rounded-xl shadow-lg overflow-y-auto flex flex-col">
        <div class="px-4 py-3 flex items-center justify-between sticky top-0 bg-indigo-600 text-white z-10 shadow">
          <h3 class="font-semibold flex items-center"><i class="fa fa-comment mr-2"></i>任务备注</h3>
          <button class="close-modal text-white hover:text-gray-200"><i class="fa fa-times"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3 remarks-list min-h-0"></div>
        <div class="border-t p-3 space-y-2 sticky bottom-0 bg-white z-10">
          <textarea class="remark-input w-full border rounded-lg p-2" rows="3" placeholder="输入备注内容（文字）"></textarea>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-3 flex-1 flex-wrap">
              <input type="file" class="remark-attach-input hidden" accept="image/*,audio/*" multiple />
              <button class="upload-attachments px-3 py-1 bg-indigo-600 text-white rounded">上传附件</button>
              <button class="record-audio px-3 py-1 bg-yellow-500 text-white rounded">开始录音</button>
              <span class="recording-indicator hidden text-orange-600 text-sm">录音中...</span>
            </div>
            <button class="submit-remark ml-auto px-3 py-1 bg-green-600 text-white rounded">保存备注</button>
          </div>
          <div class="attachments-preview mt-2 flex flex-wrap gap-2"></div>
          <div class="text-sm text-gray-500">支持文字、图片（可多选）、音频文件上传与录音</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.close-modal').addEventListener('click', () => closeModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // 文件选择按钮绑定
    const attachInput = overlay.querySelector('.remark-attach-input');
    const uploadBtn = overlay.querySelector('.upload-attachments');
    const recordBtn = overlay.querySelector('.record-audio');
    const recordingIndicator = overlay.querySelector('.recording-indicator');
    const preview = overlay.querySelector('.attachments-preview');

    // 录音按钮增加内联样式作为 Tailwind 兜底，避免白底白字导致不可见
    try {
      recordBtn.style.backgroundColor = '#f59e0b'; // 黄-500
      recordBtn.style.color = '#ffffff';
      recordBtn.style.border = '1px solid #d97706'; // 黄-600 边框
    } catch {}

    // 已上传的附件URL列表（用于提交备注）
    overlay.__uploadedImages = [];
    overlay.__uploadedAudios = [];
    uploadBtn.addEventListener('click', () => {
      if (!overlay.__taskId) {
        showToast('未找到任务ID，无法上传');
        return;
      }
      attachInput && attachInput.click();
    });
    attachInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      showToast('开始上传附件...');
            for (const f of files) {
              const isImage = (f.type || '').startsWith('image');
              const type = isImage ? 'image' : 'audio';
              try {
                let uploadFile = f;
                if (isImage) {
                  // 优先转换为 WebP，失败则使用原图
                  try {
                    uploadFile = await convertImageFileToWebP(f, 0.85);
                  } catch {}
                }
                let res = await remarkAPI.upload(overlay.__taskId, uploadFile, type);
                const url = res?.file_url || res?.url;
                // 若上传失败且为图片，尝试回退上传原图，兼容不支持 webp 的后端
                if ((!res?.success || !url) && isImage && uploadFile !== f) {
                  try {
                    const retry = await remarkAPI.upload(overlay.__taskId, f, type);
                    if (retry?.success && (retry?.file_url || retry?.url)) {
                      res = retry;
                    }
                  } catch {}
                }
                if (res?.success && (res?.file_url || res?.url)) {
                  const finalUrl = res.file_url || res.url;
                  if (isImage) {
              overlay.__uploadedImages.push(finalUrl);
              const wrap = document.createElement('div');
              wrap.className = 'relative inline-block';
              const thumb = document.createElement('img');
              thumb.src = convertUploadUrl(finalUrl);
              thumb.className = 'w-16 h-16 object-cover rounded cursor-pointer';
              thumb.title = '点击查看大图';
              thumb.addEventListener('click', () => showImageLightbox(convertUploadUrl(finalUrl)));
              const del = document.createElement('button');
              del.className = 'absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs';
              del.title = '删除图片';
              del.innerHTML = '&times;';
              del.addEventListener('click', (ev) => {
                ev.stopPropagation();
                // 从列表中移除该URL
                overlay.__uploadedImages = (overlay.__uploadedImages || []).filter(u => u !== finalUrl);
                wrap.remove();
                showToast('已移除图片');
              });
              wrap.appendChild(thumb);
              wrap.appendChild(del);
              preview.appendChild(wrap);
                  } else {
                    overlay.__uploadedAudios.push(finalUrl);
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = convertUploadUrl(finalUrl);
                    audio.className = 'h-8';
                    preview.appendChild(audio);
                  }
                  showToast('附件上传成功');
                } else {
                  showToast('附件上传失败');
                }
              } catch (err) {
                showToast('附件上传失败');
              }
            }
      // 清空选择，避免重复触发
      attachInput.value = '';
      showToast('附件上传完成');
    });

    // 录音按钮逻辑
    // 录音支持检测与逻辑
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      recordBtn.textContent = '录音不支持（请上传音频）';
      recordBtn.classList.add('opacity-60', 'cursor-not-allowed');
      recordBtn.addEventListener('click', () => showToast('当前浏览器不支持录音，请使用“上传附件”选择音频文件'));
    } else {
      recordBtn.addEventListener('click', async () => {
        try {
          if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordedChunks = [];
            recordedBlob = null;
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
              recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
              // 停止后立即上传并预览
              const file = new File([recordedBlob], 'recording.webm', { type: recordedBlob.type || 'audio/webm' });
              (async () => {
                try {
                  const res = await remarkAPI.upload(overlay.__taskId, file, 'audio');
                  const url = res?.file_url || res?.url;
                  if (res?.success && url) {
                    overlay.__uploadedAudios.push(url);
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = convertUploadUrl(url);
                    audio.className = 'h-8';
                    preview.appendChild(audio);
                    showToast('录音上传成功');
                  } else {
                    showToast('录音上传失败');
                  }
                } catch (e) {
                  showToast('录音上传失败');
                }
              })();
            };
            mediaRecorder.start();
            recordingIndicator.classList.remove('hidden');
            recordBtn.textContent = '停止录音';
          } else if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            recordingIndicator.classList.add('hidden');
            recordBtn.textContent = '开始录音';
          }
        } catch (err) {
          showToast('无法访问麦克风或浏览器不支持录音');
        }
      });
    }
    return overlay;
  }

  function closeModal() {
    const el = document.getElementById(modalId);
    if (el) el.remove();
  }

  function renderRemarkItem(remark, taskId) {
    const item = document.createElement('div');
    item.className = 'border rounded-lg p-3';
    const images = Array.isArray(remark.images) ? remark.images : (typeof remark.images === 'string' ? safeParseJSON(remark.images) : []);
    item.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="text-sm text-gray-800 flex-1 mr-2">${escapeHtml(remark.content_text || '')}</div>
        <button class="remark-speak p-1 hover:bg-blue-100 rounded" title="朗读备注"><i class="fa fa-bullhorn text-blue-600"></i></button>
      </div>
      ${images && images.length ? `<div class="flex flex-wrap mt-2">${images.map(url => `<img src="${convertUploadUrl(url)}" class="w-16 h-16 object-cover rounded mr-2 mb-2 cursor-pointer" title="点击查看大图"/>`).join('')}</div>` : ''}
      ${remark.audio_url ? `<div class="mt-2"><audio controls src="${convertUploadUrl(remark.audio_url)}"></audio></div>` : ''}
      <div class="mt-2 flex items-center space-x-3 text-sm">
        <button class="reply text-blue-600">回复</button>
        <button class="delete text-red-600">删除</button>
      </div>
      <div class="reply-area mt-2 hidden">
        <textarea class="reply-input w-full border rounded p-2" rows="2" placeholder="输入回复内容"></textarea>
        <div class="mt-2 flex justify-end">
          <button class="send-reply px-3 py-1 bg-blue-600 text-white rounded">发送</button>
        </div>
      </div>
    `;
    // 朗读备注
    const speakBtn = item.querySelector('.remark-speak');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        try {
          const synth = window.speechSynthesis;
          if (!synth) { showToast('当前浏览器不支持朗读'); return; }
          const utter = new SpeechSynthesisUtterance(remark.content_text || '');
          synth.speak(utter);
        } catch (e) { /* ignore */ }
      });
    }
    item.querySelector('.delete').addEventListener('click', async () => {
      try {
        const res = await remarkAPI.delete(remark.id);
        if (res && res.success) {
          item.remove();
        } else {
          showToast('删除失败');
        }
      } catch (e) { showToast('删除失败'); }
    });
    const replyArea = item.querySelector('.reply-area');
    const replyBtn = item.querySelector('.reply');
    const sendReplyBtn = item.querySelector('.send-reply');
    const replyInput = item.querySelector('.reply-input');
    replyBtn.addEventListener('click', () => {
      replyArea.classList.toggle('hidden');
      if (!replyArea.classList.contains('hidden')) {
        replyInput.focus();
      }
    });
    sendReplyBtn.addEventListener('click', async () => {
      const text = replyInput.value.trim();
      if (!text) { showToast('请输入回复内容'); return; }
      try {
        const userId = getCurrentUserId();
        const res = await remarkAPI.create(taskId, { userId, contentText: text, parentId: remark.id });
        if (res && res.success) {
          const overlay = document.getElementById(modalId);
          if (overlay) loadRemarks(taskId);
        } else {
          showToast('回复失败');
        }
      } catch (e) { showToast('回复失败'); }
    });
    // 备注图片点击放大
    try {
      const imgs = item.querySelectorAll('img');
      imgs.forEach(img => {
        img.addEventListener('click', () => showImageLightbox(img.src));
      });
    } catch {}
    return item;
  }

  function safeParseJSON(str) {
    try { return JSON.parse(str); } catch { return []; }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  function convertUploadUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    // 如果是以/static/开头或/开头的绝对路径，直接返回
    if (url.startsWith('/')) return url;
    // 兜底：拼到/static 下（通常不需要）
    return `/static/${url}`;
  }

  async function convertImageFileToWebP(file, quality = 0.85) {
    // 已是 webp 则直接返回
    if ((file.type || '').toLowerCase() === 'image/webp') return file;
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (!blob) { resolve(file); return; }
              const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.webp';
              const webpFile = new File([blob], name, { type: 'image/webp' });
              resolve(webpFile);
            }, 'image/webp', quality);
          } catch (err) { resolve(file); }
        };
        img.onerror = () => resolve(file);
        const reader = new FileReader();
        reader.onload = () => { img.src = reader.result; };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
      } catch (e) { resolve(file); }
    });
  }

  function showImageLightbox(url) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center';
    // 确保放大图片层级高于任何页面或弹窗内容
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `<img src="${url}" class="max-w-[90vw] max-h-[90vh] rounded shadow-2xl" />`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
  }

  function showToast(msg) {
    // 优先使用模块内引入的 domUtils
    try { domUtils.showToast(msg); return; } catch {}
    // 回退使用全局（若其它模块挂载到 window）
    try {
      if (window.domUtils && typeof window.domUtils.showToast === 'function') {
        window.domUtils.showToast(msg);
        return;
      }
    } catch {}
    // 最后回退到事件机制（如果有全局监听）
    try {
      const evt = new CustomEvent('app:toast', { detail: { message: msg }});
      window.dispatchEvent(evt);
    } catch {}
  }

  function getCurrentUserId() {
    // 从页面状态或缓存中取用户ID
    try {
      if (window.appState && window.appState.currentUser && window.appState.currentUser.id) {
        return window.appState.currentUser.id;
      }
    } catch {}
    try {
      const raw = localStorage.getItem('appState');
      if (raw) {
        const st = JSON.parse(raw);
        if (st?.user?.id) return st.user.id;
        if (st?.currentUserId) return st.currentUserId;
        if (st?.userId) return st.userId;
      }
    } catch {}
    try {
      const id = localStorage.getItem('user_id');
      if (id) return parseInt(id, 10);
    } catch {}
    return null;
  }

  async function loadRemarks(taskId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    const list = overlay.querySelector('.remarks-list');
    list.innerHTML = '';
    try {
      const data = await remarkAPI.list(taskId);
      const remarks = Array.isArray(data?.remarks) ? data.remarks : (Array.isArray(data) ? data : []);
      remarks.forEach(r => list.appendChild(renderRemarkItem(r, taskId)));
      if (!remarks.length) {
        const empty = document.createElement('div');
        empty.className = 'text-center text-gray-500 text-sm';
        empty.textContent = '暂无备注';
        list.appendChild(empty);
      }
    } catch (e) {
      const empty = document.createElement('div');
      empty.className = 'text-center text-gray-500 text-sm';
      empty.textContent = '暂无备注';
      list.appendChild(empty);
    }
  }

  async function submitRemark(taskId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    const textEl = overlay.querySelector('.remark-input');
    // 直接使用即时上传得到的URL列表

    const userId = getCurrentUserId();
    let images = overlay.__uploadedImages || [];
    let audioUrl = (overlay.__uploadedAudios && overlay.__uploadedAudios[overlay.__uploadedAudios.length - 1]) || '';

    // 优先使用录音（如果尚未上传录音，则上传并加入列表）
    if (recordedBlob && !overlay.__uploadedAudios?.length) {
      const file = new File([recordedBlob], 'recording.webm', { type: recordedBlob.type || 'audio/webm' });
      const res = await remarkAPI.upload(taskId, file, 'audio');
      const url = res?.file_url || res?.url;
      if (res && res.success && url) {
        overlay.__uploadedAudios = overlay.__uploadedAudios || [];
        overlay.__uploadedAudios.push(url);
        audioUrl = url;
      }
    }

    const contentText = textEl?.value || '';
    const result = await remarkAPI.create(taskId, { userId, contentText, images, audioUrl });
    if (result && result.success) {
      textEl.value = '';
      overlay.__uploadedImages = [];
      overlay.__uploadedAudios = [];
      recordedBlob = null;
      loadRemarks(taskId);
      showToast('备注已保存');
    } else {
      showToast('提交失败');
    }
  }

  function openRemarksModal(taskId) {
    const overlay = createModal();
    overlay.__taskId = taskId; // 用于上传附件定位到任务
    const submitBtn = overlay.querySelector('.submit-remark');
    submitBtn.onclick = () => submitRemark(taskId);
    loadRemarks(taskId);
  }

  // 暴露到全局，供 app.js 调用
  window.openRemarksModal = openRemarksModal;
})();