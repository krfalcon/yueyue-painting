const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { decode } = require('heic-decode');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDirectoryExists('./uploads');
ensureDirectoryExists('./uploads/temp');
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
        // 为 HEIF 文件生成临时文件名，稍后会转换为 JPEG
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

// HEIF/HEIC 文件类型检测 - 主要基于文件扩展名
function isHeifFile(filename, mimetype) {
    const ext = path.extname(filename).toLowerCase();
    const isHeifExt = ext === '.heic' || ext === '.heif';
    const isHeifMime = mimetype && (
        mimetype === 'image/heic' || 
        mimetype === 'image/heif' ||
        mimetype === 'image/x-heic' ||
        mimetype === 'image/x-heif'
    );
    
    return isHeifExt || isHeifMime;
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 增加到 10MB 以支持 HEIF 文件
    },
    fileFilter: function (req, file, cb) {
        // 检查文件类型 - 支持标准图片格式和 HEIF/HEIC
        const ext = path.extname(file.originalname).toLowerCase();
        const isImageMime = file.mimetype.startsWith('image/');
        const isHeicFile = ext === '.heic' || ext === '.heif';
        
        console.log(`上传文件: ${file.originalname} (${file.mimetype})`);
        
        if (isImageMime || isHeicFile) {
            cb(null, true);
        } else {
            console.log('❌ 文件类型不支持');
            cb(new Error('只允许上传图片文件！'), false);
        }
    }
});

// 图片转换和优化函数
async function convertAndOptimizeImage(inputPath, outputPath, isHeifFile = false) {
    try {
        console.log(`处理图片: ${path.basename(inputPath)}, HEIF: ${isHeifFile}`);
        
        if (isHeifFile) {
            // 对于HEIC文件，使用heic-decode库进行转换
            console.log('使用 heic-decode 转换 HEIC 文件...');
            
            const inputBuffer = fs.readFileSync(inputPath);
            const { data, width, height } = await decode({ buffer: inputBuffer });
            
            // 将解码后的数据转换为Sharp可处理的格式
            await sharp(Buffer.from(data), {
                raw: {
                    width,
                    height,
                    channels: 4 // RGBA
                }
            })
            .jpeg({ 
                quality: 85,
                progressive: true 
            })
            .resize(2048, 2048, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .toFile(outputPath);
            
            console.log(`HEIC 转换完成: ${path.basename(outputPath)}`);
            return true;
        } else {
            // 对于其他格式，直接使用Sharp处理
            await sharp(inputPath)
                .jpeg({ 
                    quality: 85,
                    progressive: true 
                })
                .resize(2048, 2048, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .toFile(outputPath);
                
            console.log(`图片处理完成: ${path.basename(outputPath)}`);
            return true;
        }
    } catch (error) {
        console.error('图片处理出错:', error);
        console.error('错误详情:', error.message);
        
        // 如果heic-decode失败，尝试使用系统工具
        if (isHeifFile) {
            console.log('heic-decode 失败，尝试使用系统工具转换 HEIF...');
            return await convertHeifWithSystemTool(inputPath, outputPath);
        }
        
        return false;
    }
}

// 使用系统工具转换 HEIF（备用方案）
async function convertHeifWithSystemTool(inputPath, outputPath) {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // 检查是否有 sips 命令（macOS 系统工具）
        try {
            await execPromise('which sips');
            console.log('使用 macOS sips 工具转换 HEIF...');
            
            // 使用 sips 转换 HEIF 到 JPEG
            await execPromise(`sips -s format jpeg "${inputPath}" --out "${outputPath}"`);
            
            // 使用 Sharp 进一步优化
            const tempPath = outputPath + '.temp';
            await sharp(outputPath)
                .jpeg({ 
                    quality: 85,
                    progressive: true 
                })
                .resize(2048, 2048, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .toFile(tempPath);
                
            // 替换原文件
            fs.renameSync(tempPath, outputPath);
            
            console.log('HEIF 转换成功（使用系统工具）');
            return true;
        } catch (sipsError) {
            console.log('sips 工具不可用，尝试其他方法...');
        }
        
        // 如果没有系统工具，返回错误
        console.error('无法转换 HEIF 文件：缺少必要的转换工具');
        return false;
        
    } catch (error) {
        console.error('系统工具转换失败:', error);
        return false;
    }
}

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
app.post('/api/upload', upload.single('painting'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择要上传的图片文件' });
        }

        const originalPath = req.file.path;
        const originalExt = path.extname(req.file.filename).toLowerCase();
        let finalFilename = req.file.filename;
        let finalPath = originalPath;
        
        // 简化的 HEIC 检测 - 直接检查文件扩展名
        const originalNameExt = path.extname(req.file.originalname).toLowerCase();
        const isHeicFile = originalNameExt === '.heic' || originalNameExt === '.heif' || 
                          originalExt === '.heic' || originalExt === '.heif';
        
        console.log(`处理文件: ${req.file.originalname}, HEIC: ${isHeicFile}`);
        
        // 如果是 HEIC 文件，必须转换为 JPEG
        if (isHeicFile) {
            
            console.log(`处理 HEIF 文件: ${req.file.originalname}`);
            
            // 生成新的 JPEG 文件名，确保替换大小写不敏感的扩展名
            const baseFilename = path.basename(req.file.filename, path.extname(req.file.filename));
            const jpegFilename = baseFilename + '.jpg';
            const jpegPath = path.join('./uploads', jpegFilename);
            
            // 转换文件，传递 HEIF 标识
            const conversionSuccess = await convertAndOptimizeImage(originalPath, jpegPath, true);
            
            if (conversionSuccess) {
                // 删除原始文件
                if (fs.existsSync(originalPath)) {
                    fs.unlinkSync(originalPath);
                }
                
                finalFilename = jpegFilename;
                finalPath = jpegPath;
                
                console.log(`HEIF 转换成功: ${jpegFilename}`);
            } else {
                // 转换失败，删除原始文件
                if (fs.existsSync(originalPath)) {
                    fs.unlinkSync(originalPath);
                }
                return res.status(500).json({ error: 'HEIF 文件转换失败' });
            }
        } else {
            // 对于其他格式的图片，进行优化
            const optimizedFilename = req.file.filename.replace(/\.(png|gif|bmp|webp)$/i, '.jpg');
            if (optimizedFilename !== req.file.filename) {
                const optimizedPath = path.join('./uploads', optimizedFilename);
                
                const optimizationSuccess = await convertAndOptimizeImage(originalPath, optimizedPath);
                
                if (optimizationSuccess) {
                    // 删除原始文件
                    if (fs.existsSync(originalPath)) {
                        fs.unlinkSync(originalPath);
                    }
                    
                    finalFilename = optimizedFilename;
                    finalPath = optimizedPath;
                    
                    console.log(`图片优化成功: ${optimizedFilename}`);
                }
            }
        }

        // 创建新的画作记录
        const newPainting = {
            id: uuidv4(),
            filename: finalFilename,
            originalName: req.file.originalname,
            imageUrl: `/uploads/${finalFilename}`,
            date: new Date().toISOString(),
            size: fs.statSync(finalPath).size
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
            if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath);
            }
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