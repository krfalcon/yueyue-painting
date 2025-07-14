// 悦悦画廊管理后台 JavaScript

let paintings = [];

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaintings();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('painting-file');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFilePreview);
    }
}

// 处理文件预览
function handleFilePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('preview-image');
    
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.classList.add('hidden');
    }
}

// 加载所有画作
async function loadPaintings() {
    try {
        const response = await fetch('/api/paintings');
        if (response.ok) {
            paintings = await response.json();
            displayPaintingList(paintings);
        } else {
            console.error('无法加载画作列表');
        }
    } catch (error) {
        console.error('加载画作时出错:', error);
        // 如果无法连接服务器，显示示例数据
        displaySamplePaintingList();
    }
}

// 显示画作列表
function displayPaintingList(paintingList) {
    const listContainer = document.getElementById('painting-list');
    
    if (paintingList.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <h3 style="margin-bottom: 15px;">还没有画作</h3>
                <p>上传第一幅画作开始建立悦悦的画廊吧！</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = paintingList.map(painting => `
        <div class="painting-item">
            <img src="${painting.imageUrl}" alt="悦悦的画作" class="painting-thumb">
            <div class="painting-details">
                <p style="font-size: 0.9em; color: #666;">${formatDate(painting.date)}</p>
            </div>
            <div class="painting-actions">
                <button class="delete-btn" onclick="deletePainting('${painting.id}')" 
                        style="background: #ff6b6b; color: white; border: none; padding: 8px 15px; 
                               border-radius: 15px; cursor: pointer; font-size: 0.9em;">删除</button>
            </div>
        </div>
    `).join('');
}

// 显示示例数据（当服务器未启动时）
function displaySamplePaintingList() {
    const samplePaintings = [
        {
            id: 'sample1',
            imageUrl: 'https://via.placeholder.com/60x60/FFB6C1/FFFFFF?text=1',
            date: new Date().toISOString()
        },
        {
            id: 'sample2', 
            imageUrl: 'https://via.placeholder.com/60x60/98FB98/FFFFFF?text=2',
            date: new Date(Date.now() - 86400000).toISOString()
        }
    ];
    
    displayPaintingList(samplePaintings);
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 处理上传
async function handleUpload(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    // 验证文件
    const fileInput = document.getElementById('painting-file');
    if (!fileInput.files[0]) {
        showMessage('请选择要上传的图片文件', 'error');
        return;
    }
    
    // 验证文件大小 (限制为 5MB)
    if (fileInput.files[0].size > 5 * 1024 * 1024) {
        showMessage('图片文件不能超过 5MB', 'error');
        return;
    }
    
    // 验证文件类型
    if (!fileInput.files[0].type.startsWith('image/')) {
        showMessage('请选择有效的图片文件', 'error');
        return;
    }
    
    // 显示加载状态
    submitBtn.innerHTML = '<span class="loading"></span> 上传中...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage('画作上传成功！', 'success');
            
            // 重新加载画作列表
            await loadPaintings();
            
            // 重置表单
            form.reset();
            document.getElementById('preview-image').classList.add('hidden');
        } else {
            const error = await response.json();
            showMessage('上传失败：' + (error.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('上传出错:', error);
        showMessage('上传失败：网络连接错误', 'error');
    }
    
    // 恢复按钮状态
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
}

// 删除画作
async function deletePainting(paintingId) {
    if (!confirm('确定要删除这幅画作吗？此操作无法撤销。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/paintings/${paintingId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showMessage('画作删除成功', 'success');
            await loadPaintings();
        } else {
            const error = await response.json();
            showMessage('删除失败：' + (error.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('删除出错:', error);
        showMessage('删除失败：网络连接错误', 'error');
    }
}

// 显示消息
function showMessage(text, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
        uploadSection.insertBefore(message, uploadSection.firstChild.nextSibling);
    }
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// 添加拖拽上传功能
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('painting-file');
    const uploadForm = document.getElementById('upload-form');
    
    // 防止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadForm.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // 高亮放置区域
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadForm.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadForm.addEventListener(eventName, unhighlight, false);
    });
    
    // 处理放置
    uploadForm.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        uploadForm.style.backgroundColor = '#f0f8ff';
        uploadForm.style.borderColor = '#FFB6C1';
    }
    
    function unhighlight(e) {
        uploadForm.style.backgroundColor = '';
        uploadForm.style.borderColor = '';
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFilePreview({ target: { files: files } });
        }
    }
});