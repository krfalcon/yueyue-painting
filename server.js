const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDirectoryExists('./uploads');
ensureDirectoryExists('./data');
ensureDirectoryExists('./public/images');

// 静态文件服务
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// JSON 解析
app.use(express.json());

// 数据存储路径
const PAINTINGS_DATA_FILE = './data/paintings.json';

// 读取画作数据
function readPaintingsData() {
    try {
        if (fs.existsSync(PAINTINGS_DATA_FILE)) {
            const data = fs.readFileSync(PAINTINGS_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取画作数据出错:', error);
    }
    return [];
}

// 写入画作数据
function writePaintingsData(paintings) {
    try {
        fs.writeFileSync(PAINTINGS_DATA_FILE, JSON.stringify(paintings, null, 2));
        return true;
    } catch (error) {
        console.error('写入画作数据出错:', error);
        return false;
    }
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 限制
    },
    fileFilter: function (req, file, cb) {
        // 检查文件类型
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件！'), false);
        }
    }
});

// 路由处理

// 获取所有画作
app.get('/api/paintings', (req, res) => {
    try {
        const paintings = readPaintingsData();
        // 按日期降序排列（最新的在前面）
        paintings.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(paintings);
    } catch (error) {
        console.error('获取画作列表出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 上传新画作
app.post('/api/upload', upload.single('painting'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择要上传的图片文件' });
        }

        // 创建新的画作记录
        const newPainting = {
            id: uuidv4(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            imageUrl: `/uploads/${req.file.filename}`,
            date: new Date().toISOString(),
            size: req.file.size
        };

        // 读取现有数据
        const paintings = readPaintingsData();
        
        // 添加新画作
        paintings.push(newPainting);
        
        // 保存数据
        if (writePaintingsData(paintings)) {
            res.json({
                success: true,
                message: '画作上传成功！',
                painting: newPainting
            });
        } else {
            // 如果保存失败，删除已上传的文件
            fs.unlinkSync(req.file.path);
            res.status(500).json({ error: '保存画作信息失败' });
        }

    } catch (error) {
        console.error('上传画作出错:', error);
        
        // 清理已上传的文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: '上传失败：' + error.message });
    }
});

// 删除画作
app.delete('/api/paintings/:id', (req, res) => {
    try {
        const paintingId = req.params.id;
        const paintings = readPaintingsData();
        
        // 查找要删除的画作
        const paintingIndex = paintings.findIndex(p => p.id === paintingId);
        
        if (paintingIndex === -1) {
            return res.status(404).json({ error: '画作不存在' });
        }
        
        const painting = paintings[paintingIndex];
        
        // 删除图片文件
        const imagePath = path.join('./uploads', painting.filename);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        
        // 从数组中移除
        paintings.splice(paintingIndex, 1);
        
        // 保存更新后的数据
        if (writePaintingsData(paintings)) {
            res.json({
                success: true,
                message: '画作删除成功'
            });
        } else {
            res.status(500).json({ error: '删除画作信息失败' });
        }

    } catch (error) {
        console.error('删除画作出错:', error);
        res.status(500).json({ error: '删除失败：' + error.message });
    }
});

// 获取单个画作
app.get('/api/paintings/:id', (req, res) => {
    try {
        const paintingId = req.params.id;
        const paintings = readPaintingsData();
        
        const painting = paintings.find(p => p.id === paintingId);
        
        if (!painting) {
            return res.status(404).json({ error: '画作不存在' });
        }
        
        res.json(painting);

    } catch (error) {
        console.error('获取画作出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 更新画作信息（已简化，主要用于日期修改等）
app.put('/api/paintings/:id', (req, res) => {
    try {
        const paintingId = req.params.id;
        const { date } = req.body;
        const paintings = readPaintingsData();
        
        const paintingIndex = paintings.findIndex(p => p.id === paintingId);
        
        if (paintingIndex === -1) {
            return res.status(404).json({ error: '画作不存在' });
        }
        
        // 更新画作信息
        if (date) {
            paintings[paintingIndex].date = date;
        }
        
        if (writePaintingsData(paintings)) {
            res.json({
                success: true,
                message: '画作信息更新成功',
                painting: paintings[paintingIndex]
            });
        } else {
            res.status(500).json({ error: '更新画作信息失败' });
        }

    } catch (error) {
        console.error('更新画作出错:', error);
        res.status(500).json({ error: '更新失败：' + error.message });
    }
});

// 获取画廊统计信息
app.get('/api/stats', (req, res) => {
    try {
        const paintings = readPaintingsData();
        
        const stats = {
            totalPaintings: paintings.length,
            totalSize: paintings.reduce((sum, painting) => sum + (painting.size || 0), 0),
            firstPainting: paintings.length > 0 ? paintings.reduce((earliest, painting) => 
                new Date(painting.date) < new Date(earliest.date) ? painting : earliest
            ).date : null,
            latestPainting: paintings.length > 0 ? paintings.reduce((latest, painting) => 
                new Date(painting.date) > new Date(latest.date) ? painting : latest
            ).date : null
        };
        
        res.json(stats);

    } catch (error) {
        console.error('获取统计信息出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小不能超过 5MB' });
        }
    }
    
    console.error('服务器错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: '找不到请求的资源' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🎨 悦悦画廊服务器已启动`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`👩‍💼 管理后台: http://localhost:${PORT}/admin.html`);
    console.log(`📂 数据存储: ${path.resolve(PAINTINGS_DATA_FILE)}`);
    console.log(`🖼️  图片存储: ${path.resolve('./uploads')}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n👋 正在关闭悦悦画廊服务器...');
    process.exit(0);
});

module.exports = app;