// 悦悦画廊主页面 JavaScript

let paintings = [];

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPaintings();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
    
    // 点击画廊外部关闭模态框
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    // 键盘事件
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            if (!document.getElementById('admin-panel').classList.contains('hidden')) {
                toggleAdmin();
            }
        }
    });
}

// 加载所有画作
async function loadPaintings() {
    try {
        const response = await fetch('/api/paintings');
        if (response.ok) {
            paintings = await response.json();
            displayPaintings(paintings);
        } else {
            console.error('无法加载画作列表');
        }
    } catch (error) {
        console.error('加载画作时出错:', error);
        // 如果无法连接服务器，显示示例数据
        displaySamplePaintings();
    }
}

// 显示画作列表
function displayPaintings(paintingList) {
    const gallery = document.getElementById('gallery');
    
    if (paintingList.length === 0) {
        gallery.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <h2 style="color: #FF69B4; font-size: 2em; margin-bottom: 20px;">🎨</h2>
                <h3 style="color: #666; font-size: 1.3em; margin-bottom: 15px;">还没有画作哦</h3>
                <p style="color: #999; font-size: 1.1em;">快点击"管理"按钮上传悦悦的第一幅画吧！</p>
            </div>
        `;
        return;
    }
    
    gallery.innerHTML = paintingList.map(painting => `
        <div class="painting-card" onclick="openModal('${painting.id}')">
            <img src="${painting.imageUrl}" alt="悦悦的画作" class="painting-image">
            <div class="painting-info">
                <p class="painting-date">${formatDate(painting.date)}</p>
            </div>
        </div>
    `).join('');
}

// 显示示例数据（当服务器未启动时）
function displaySamplePaintings() {
    const samplePaintings = [
        {
            id: 'sample1',
            imageUrl: 'https://via.placeholder.com/300x400/FFB6C1/FFFFFF?text=悦悦的画作1',
            date: new Date().toISOString()
        },
        {
            id: 'sample2', 
            imageUrl: 'https://via.placeholder.com/300x500/98FB98/FFFFFF?text=悦悦的画作2',
            date: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 'sample3', 
            imageUrl: 'https://via.placeholder.com/300x350/87CEEB/FFFFFF?text=悦悦的画作3',
            date: new Date(Date.now() - 172800000).toISOString()
        }
    ];
    
    displayPaintings(samplePaintings);
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 打开画作详情模态框
function openModal(paintingId) {
    const painting = paintings.find(p => p.id === paintingId);
    if (!painting) {
        console.error('找不到指定的画作');
        return;
    }
    
    const modal = document.getElementById('painting-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const modalDate = document.getElementById('modal-date');
    
    modalImage.src = painting.imageUrl;
    modalImage.alt = '悦悦的画作';
    modalDate.textContent = `创作于 ${formatDate(painting.date)}`;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('painting-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// 切换管理员面板
function toggleAdmin() {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel.classList.contains('hidden')) {
        adminPanel.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        adminPanel.classList.add('hidden');
        document.body.style.overflow = '';
        // 重置表单
        const form = document.getElementById('upload-form');
        if (form) {
            form.reset();
        }
    }
}

// 处理上传
async function handleUpload(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
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
            
            // 关闭管理员面板
            toggleAdmin();
            
            // 重置表单
            form.reset();
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

// 显示消息
function showMessage(text, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
        adminContent.insertBefore(message, adminContent.firstChild);
    }
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// 添加一些可爱的交互效果
document.addEventListener('DOMContentLoaded', function() {
    // 为页面添加一些随机的小装饰元素
    createFloatingElements();
});

function createFloatingElements() {
    const elements = ['🌸', '🌟', '🦋', '🌈', '💖', '✨'];
    
    setInterval(() => {
        if (Math.random() > 0.7) { // 30%概率生成装饰元素
            const element = document.createElement('div');
            element.textContent = elements[Math.floor(Math.random() * elements.length)];
            element.style.cssText = `
                position: fixed;
                top: -30px;
                left: ${Math.random() * 100}vw;
                font-size: ${15 + Math.random() * 10}px;
                pointer-events: none;
                z-index: 1;
                animation: float-down 4s linear forwards;
                opacity: 0.6;
            `;
            
            document.body.appendChild(element);
            
            // 4秒后移除元素
            setTimeout(() => {
                element.remove();
            }, 4000);
        }
    }, 2000);
}

// 添加飘落动画的CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes float-down {
        0% {
            transform: translateY(-30px) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 0.6;
        }
        90% {
            opacity: 0.6;
        }
        100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);