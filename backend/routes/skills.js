const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const { pinyin } = require('pinyin-pro');

const router = express.Router();

// 生成slug：中文转拼音，英文保留，空格和特殊字符转-
function generateSlug(title) {
  // 检测是否包含中文字符
  const hasChinese = /[一-龥]/.test(title);

  let processed;
  if (hasChinese) {
    // 包含中文：将中文转为拼音，英文保留原样
    processed = title.replace(/[一-龥]+/g, (match) => {
      return pinyin(match, { toneType: 'none', type: 'array' }).join('-');
    });
  } else {
    // 纯英文/数字：直接使用原文本
    processed = title;
  }

  const slugText = processed
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // 其他字符转-
    .replace(/-+/g, '-')           // 多个-合并
    .replace(/^-|-$/g, '');        // 去掉首尾-
  return slugText || 'skill';
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，添加时间戳避免冲突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // 接收所有文件类型
    cb(null, true);
  }
});

// Get all skills with search and filter (只显示已审核通过的)
router.get('/', async (req, res) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT s.*, u.username as author_name, u.department as author_department
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
    `;
    let conditions = ['s.status = ?'];
    let params = ['approved'];

    if (search) {
      conditions.push('(s.title LIKE ? OR s.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      conditions.push('s.category = ?');
      params.push(category);
    }

    query += ' WHERE ' + conditions.join(' AND ');

    // 使用 query 而不是 execute，直接拼接 LIMIT 和 OFFSET
    const countParams = [...params];
    query += ` ORDER BY s.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [skills] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM skills s WHERE s.status = ?';
    const countParams2 = ['approved'];
    if (search) {
      countQuery += ' AND (s.title LIKE ? OR s.description LIKE ?)';
      countParams2.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      countQuery += ' AND s.category = ?';
      countParams2.push(category);
    }
    const [countResult] = await pool.query(countQuery, countParams2);
    const total = countResult[0].total;

    res.json({
      skills,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single skill with versions - 允许作者和管理员查看任何状态的技能
router.get('/:id', async (req, res, next) => {
  try {
    // 特殊路径：batch-install-link 是批量下载链接接口，跳过此路由
    if (req.params.id === 'batch-install-link' || req.params.id === 'install-link') {
      return next('route');
    }

    const [skills] = await pool.execute(
      `SELECT s.*, u.username as author_name, u.department as author_department,
              p.name as project_name
       FROM skills s
       JOIN users u ON s.author_id = u.employee_id
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (skills.length === 0) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    const skill = skills[0];

    // 如果技能未通过审核，只允许作者和管理员查看
    if (skill.status !== 'approved') {
      // 检查是否有认证token
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        return res.status(403).json({ message: '该技能正在审核中或已被拒绝' });
      }

      const token = authHeader.replace('Bearer ', '');
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yaxun_skill_hub_secret_key_2024');

        // 检查是否是作者或管理员
        const isAuthor = decoded.employee_id === skill.author_id;
        const isAdmin = decoded.role === 'super_admin' || decoded.role === 'admin';

        if (!isAuthor && !isAdmin) {
          return res.status(403).json({ message: '该技能正在审核中或已被拒绝' });
        }
      } catch (e) {
        return res.status(403).json({ message: '该技能正在审核中或已被拒绝' });
      }
    }

    // Get comments
    const [comments] = await pool.execute(
      `SELECT c.*, u.username as user_name
       FROM comments c
       JOIN users u ON c.user_id = u.employee_id
       WHERE c.skill_id = ?
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );

    // Get versions
    const [versions] = await pool.execute(
      `SELECT sv.*, u.username as author_name
       FROM skill_versions sv
       JOIN users u ON sv.created_by = u.employee_id
       WHERE sv.skill_id = ?
       ORDER BY sv.created_at DESC`,
      [req.params.id]
    );

    // Generate install command
    const serverUrl = 'http://172.16.91.149:8080';
    const installCommand = skill.file_path
      ? `curl -s ${serverUrl}/api/skills/${encodeURIComponent(skill.title)}/install | python`
      : null;

    res.json({
      skill: {
        ...skill,
        install_command: installCommand,
        versions: versions
      },
      comments
    });
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create skill (with file upload) - 普通用户需要审核，管理员直接通过
router.post('/', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件大小超过50MB限制' });
      }
      return res.status(400).json({ message: '文件上传失败: ' + err.message });
    }

    try {
      console.log('Request body:', req.body);
      const { title, description, category, project_id, content } = req.body;
      const filePath = req.file ? `/uploads/${req.file.filename}` : null;

      if (!title || !category) {
        return res.status(400).json({ message: '标题和分类是必填项' });
      }

      // 如果是项目分类，必须有project_id
      if (category === '项目' && !project_id) {
        return res.status(400).json({ message: '项目分类必须选择项目目录' });
      }

      const projectIdValue = category === '项目' ? parseInt(project_id) : null;

      // 生成slug
      const slug = generateSlug(title);

      // 判断用户角色：管理员直接通过，普通用户需要审核
      const userRole = req.user.role;
      const status = (userRole === 'super_admin' || userRole === 'admin') ? 'approved' : 'pending';

      const [result] = await pool.execute(
        `INSERT INTO skills (title, slug, description, category, project_id, content, file_path, author_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, slug, description || '', category, projectIdValue, content || '', filePath, req.user.employee_id, status]
      );

      res.status(201).json({
        message: status === 'approved' ? '技能上传成功' : '上传申请已提交，等待管理员审核',
        status: status,
        skill: {
          id: result.insertId,
          title,
          slug,
          description,
          category,
          project_id: projectIdValue,
          content,
          file_path: filePath,
          author_id: req.user.employee_id,
          status: status
        }
      });
    } catch (error) {
      console.error('Create skill error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Batch upload skills - 批量上传
router.post('/batch', authMiddleware, (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件大小超过50MB限制' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: '最多支持20个文件同时上传' });
      }
      return res.status(400).json({ message: '文件上传失败: ' + err.message });
    }

    try {
      const { category, project_id, description } = req.body;
      console.log('Batch upload - category:', category, 'project_id:', project_id, 'description:', description);
      const titles = Array.isArray(req.body.titles) ? req.body.titles : [req.body.titles].filter(Boolean);
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({ message: '请选择要上传的文件' });
      }

      if (!category) {
        return res.status(400).json({ message: '分类是必填项' });
      }

      if (category === '项目' && !project_id) {
        return res.status(400).json({ message: '项目分类必须选择项目目录' });
      }

      const projectIdValue = category === '项目' ? parseInt(project_id) : null;
      const userRole = req.user.role;
      const status = (userRole === 'super_admin' || userRole === 'admin') ? 'approved' : 'pending';

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = titles[i] || file.originalname.replace(/\.[^/.]+$/, '');
        const filePath = `/uploads/${file.filename}`;
        const slug = generateSlug(title);

        try {
          const [result] = await pool.execute(
            `INSERT INTO skills (title, slug, description, category, project_id, file_path, author_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, slug, description || '', category, projectIdValue, filePath, req.user.employee_id, status]
          );

          results.push({
            title,
            success: true,
            id: result.insertId
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to create skill "${title}":`, error);
          results.push({
            title,
            success: false,
            error: error.message || '创建失败'
          });
          failCount++;
        }
      }

      res.status(201).json({
        message: `批量上传完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        successCount,
        failCount,
        results
      });

    } catch (error) {
      console.error('Batch upload error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Folder upload - 文件夹上传（打包为ZIP）
router.post('/folder', authMiddleware, (req, res) => {
  upload.array('files', 200)(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件大小超过50MB限制' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: '最多支持200个文件' });
      }
      return res.status(400).json({ message: '文件上传失败: ' + err.message });
    }

    try {
      const { title, category, project_id, description, relativePaths } = req.body;
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({ message: '请选择要上传的文件夹' });
      }

      if (!title) {
        return res.status(400).json({ message: '标题是必填项' });
      }

      if (!category) {
        return res.status(400).json({ message: '分类是必填项' });
      }

      if (category === '项目' && !project_id) {
        return res.status(400).json({ message: '项目分类必须选择项目目录' });
      }

      const projectIdValue = category === '项目' ? parseInt(project_id) : null;
      const userRole = req.user.role;
      const status = (userRole === 'super_admin' || userRole === 'admin') ? 'approved' : 'pending';

      // 打包文件夹为ZIP文件
      const { ZipArchive } = require('archiver');
      const slug = generateSlug(title);
      const zipFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${slug}.zip`;
      const zipFilePath = path.join(uploadsDir, zipFileName);

      // 创建ZIP文件
      const output = fs.createWriteStream(zipFilePath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      archive.pipe(output);

      // 添加文件到ZIP，保留目录结构
      const paths = Array.isArray(relativePaths) ? relativePaths : [relativePaths];
      files.forEach((file, index) => {
        const relativePath = paths[index] || file.originalname;
        // 从路径中移除根文件夹名，保留内部结构
        const internalPath = relativePath.split('/').slice(1).join('/') || file.originalname;
        archive.file(file.path, { name: internalPath });
      });

      await archive.finalize();

      // 等待ZIP完成
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });

      // 检查ZIP文件大小
      const zipStats = fs.statSync(zipFilePath);
      if (zipStats.size > 50 * 1024 * 1024) {
        fs.unlinkSync(zipFilePath);
        return res.status(400).json({ message: '打包后的ZIP文件超过50MB限制' });
      }

      const filePath = `/uploads/${zipFileName}`;

      // 删除原始文件（已打包到ZIP）
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      const [result] = await pool.execute(
        `INSERT INTO skills (title, slug, description, category, project_id, file_path, author_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, slug, description || '', category, projectIdValue, filePath, req.user.employee_id, status]
      );

      res.status(201).json({
        message: status === 'approved' ? '文件夹上传成功' : '上传申请已提交，等待管理员审核',
        status: status,
        skill: {
          id: result.insertId,
          title,
          slug,
          description,
          category,
          project_id: projectIdValue,
          file_path: filePath,
          author_id: req.user.employee_id,
          status: status
        }
      });

    } catch (error) {
      console.error('Folder upload error:', error);
      // 清理临时文件
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Update skill
router.put('/:id', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件大小超过50MB限制' });
      }
      return res.status(400).json({ message: '文件上传失败: ' + err.message });
    }

    try {
      const [skills] = await pool.execute(
        'SELECT author_id, file_path FROM skills WHERE id = ?',
        [req.params.id]
      );

      if (skills.length === 0) {
        return res.status(404).json({ message: 'Skill not found' });
      }

      if (skills[0].author_id !== req.user.employee_id) {
        return res.status(403).json({ message: 'Not authorized to update this skill' });
      }

      const { title, description, category, content } = req.body;
      const filePath = req.file ? `/uploads/${req.file.filename}` : skills[0].file_path;

      await pool.execute(
        `UPDATE skills SET title = ?, description = ?, category = ?, content = ?, file_path = ?
         WHERE id = ?`,
        [title, description || '', category, content || '', filePath, req.params.id]
      );

      res.json({ message: 'Skill updated successfully' });
    } catch (error) {
      console.error('Update skill error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Delete skill
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [skills] = await pool.execute(
      'SELECT author_id, file_path FROM skills WHERE id = ?',
      [req.params.id]
    );

    if (skills.length === 0) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    if (skills[0].author_id !== req.user.employee_id) {
      return res.status(403).json({ message: 'Not authorized to delete this skill' });
    }

    await pool.execute('DELETE FROM comments WHERE skill_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM skills WHERE id = ?', [req.params.id]);

    if (skills[0].file_path) {
      const filePath = path.join(__dirname, '../..', skills[0].file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download file - 只有approved状态的技能才能下载
router.get('/:id/file', async (req, res) => {
  try {
    const [skills] = await pool.execute(
      'SELECT file_path, title, status FROM skills WHERE id = ?',
      [req.params.id]
    );

    if (skills.length === 0 || !skills[0].file_path) {
      return res.status(404).json({ message: 'File not found' });
    }

    // 检查技能状态，只有approved状态才能下载
    if (skills[0].status !== 'approved') {
      return res.status(403).json({ message: '该技能未通过审核，无法下载' });
    }

    const filePath = path.join(__dirname, '../..', skills[0].file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // 提取原始文件名
    const fullFileName = path.basename(filePath);
    const match = fullFileName.match(/^\d+-\d+-(.+)$/);
    const originalFileName = match ? match[1] : fullFileName;

    // 生成ASCII安全的下载文件名（拼音+扩展名）
    const ext = originalFileName.split('.').pop();
    const safeFileName = generateSlug(skills[0].title) + '.' + ext;

    await pool.execute(
      'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
      [req.params.id]
    );

    // 使用ASCII安全的文件名下载，避免Windows兼容问题
    res.download(filePath, safeFileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Increment download count
router.post('/:id/download', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
      [req.params.id]
    );

    const [skills] = await pool.execute(
      'SELECT file_path, content, title FROM skills WHERE id = ?',
      [req.params.id]
    );

    res.json(skills[0]);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment (支持回复)
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content, parent_id } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // 如果是回复，检查parent_id是否存在
    if (parent_id) {
      const [parentComment] = await pool.execute(
        'SELECT id FROM comments WHERE id = ? AND skill_id = ?',
        [parent_id, req.params.id]
      );
      if (parentComment.length === 0) {
        return res.status(400).json({ message: 'Parent comment not found' });
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO comments (skill_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.employee_id, content, parent_id || null]
    );

    res.status(201).json({
      message: 'Comment added',
      comment: {
        id: result.insertId,
        skill_id: parseInt(req.params.id),
        user_id: req.user.employee_id,
        user_name: req.user.username,
        content,
        parent_id: parent_id || null
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get versions for a skill
router.get('/:id/versions', async (req, res) => {
  try {
    const [versions] = await pool.execute(
      `SELECT sv.*, u.username as author_name
       FROM skill_versions sv
       JOIN users u ON sv.created_by = u.employee_id
       WHERE sv.skill_id = ?
       ORDER BY sv.created_at DESC`,
      [req.params.id]
    );

    res.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new version
router.post('/:id/versions', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: '文件上传失败: ' + err.message });
    }

    try {
      const { version, description } = req.body;

      if (!version) {
        return res.status(400).json({ message: '版本号是必填项' });
      }

      // Check if skill exists
      const [skills] = await pool.execute(
        'SELECT id FROM skills WHERE id = ?',
        [req.params.id]
      );

      if (skills.length === 0) {
        return res.status(404).json({ message: 'Skill not found' });
      }

      const filePath = req.file ? `/uploads/${req.file.filename}` : null;

      const [result] = await pool.execute(
        `INSERT INTO skill_versions (skill_id, version, description, file_path, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, version, description || '', filePath, req.user.employee_id]
      );

      res.status(201).json({
        message: 'Version added successfully',
        version: {
          id: result.insertId,
          skill_id: parseInt(req.params.id),
          version,
          description,
          file_path: filePath,
          created_by: req.user.employee_id,
          author_name: req.user.username
        }
      });
    } catch (error) {
      console.error('Add version error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// Download specific version
router.get('/:id/versions/:versionId/file', async (req, res) => {
  try {
    const [versions] = await pool.execute(
      'SELECT sv.file_path, s.title, sv.version FROM skill_versions sv JOIN skills s ON sv.skill_id = s.id WHERE sv.id = ? AND sv.skill_id = ?',
      [req.params.versionId, req.params.id]
    );

    if (versions.length === 0 || !versions[0].file_path) {
      return res.status(404).json({ message: 'Version file not found' });
    }

    const filePath = path.join(__dirname, '../..', versions[0].file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const fullFileName = path.basename(filePath);
    const match = fullFileName.match(/^\d+-\d+-(.+)$/);
    const originalFileName = match ? match[1] : fullFileName;
    const downloadName = `${versions[0].title}_v${versions[0].version}_${originalFileName}`;

    res.download(filePath, downloadName);
  } catch (error) {
    console.error('Download version error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Install script endpoint - returns a Python script that downloads and installs the skill
// 只有approved状态的技能才能生成安装脚本
router.get('/:id/install', async (req, res) => {
  try {
    // Support ID, slug, or title lookup
    const param = req.params.id;

    // 先尝试用ID查找（如果是数字）
    if (/^\d+$/.test(param)) {
      const [skillsById] = await pool.execute(
        'SELECT s.id, s.title, s.slug, s.file_path, s.content, s.description, s.category, s.status FROM skills s WHERE s.id = ?',
        [parseInt(param)]
      );
      if (skillsById.length > 0) {
        // 检查技能状态
        if (skillsById[0].status !== 'approved') {
          return res.status(403).send('# Error: 该技能未通过审核，无法安装');
        }
        return generateInstallScript(res, skillsById[0]);
      }
    }

    // 如果ID没找到或者不是数字，尝试用slug或title查找
    const [skills] = await pool.execute(
      'SELECT s.id, s.title, s.slug, s.file_path, s.content, s.description, s.category, s.status FROM skills s WHERE s.slug = ? OR s.title = ?',
      [param, param]
    );

    if (skills.length === 0) {
      return res.status(404).send('# Error: Skill not found');
    }

    // 检查技能状态
    if (skills[0].status !== 'approved') {
      return res.status(403).send('# Error: 该技能未通过审核，无法安装');
    }

    return generateInstallScript(res, skills[0]);
  } catch (error) {
    console.error('Install script error:', error);
    res.status(500).send('# Error: Server error');
  }
});

function generateInstallScript(res, skill) {
  const serverUrl = 'http://172.16.91.149:8080';
  const skillId = skill.id;
  const skillSlug = skill.slug || skill.id;

  // Generate Python installer script
  const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill Hub Installer - ${skill.title}"""

import sys
import os
import urllib.request
import shutil
import zipfile

SERVER_URL = "${serverUrl}"
SKILL_ID = ${skillId}
SKILL_TITLE = "${skill.title}"

def download_and_extract():
    file_url = f"{SERVER_URL}/api/skills/{SKILL_ID}/file"

    target_dir = os.getcwd()

    print(f"Downloading: {SKILL_TITLE}")
    print(f"Target: {target_dir}/.skill-hub")

    try:
        skill_dir = os.path.join(target_dir, ".skill-hub")
        os.makedirs(skill_dir, exist_ok=True)

        print("Downloading...")
        req = urllib.request.Request(file_url)
        with urllib.request.urlopen(req) as response:
            content_disp = response.headers.get('Content-Disposition', '')
            filename = SKILL_TITLE
            if 'filename=' in content_disp:
                filename = content_disp.split('filename=')[1].strip().strip('"')

            # Download to temp location
            temp_path = os.path.join(skill_dir, '_temp_' + filename)
            with open(temp_path, 'wb') as f:
                shutil.copyfileobj(response, f)

            file_size = os.path.getsize(temp_path)

            # Check if it's a ZIP file and extract
            if filename.lower().endswith('.zip') or zipfile.is_zipfile(temp_path):
                # Create extraction folder using skill title
                extract_name = SKILL_TITLE if not SKILL_TITLE.lower().endswith('.zip') else SKILL_TITLE[:-4]
                extract_dir = os.path.join(skill_dir, extract_name)
                os.makedirs(extract_dir, exist_ok=True)

                print("Extracting...")
                with zipfile.ZipFile(temp_path, 'r') as zf:
                    zf.extractall(extract_dir)

                # Remove the ZIP file after extraction
                os.remove(temp_path)

                # Count extracted files
                extracted_files = [f for f in os.listdir(extract_dir) if not f.startswith('.')]
                print(f"Extracted: {extract_name}/ ({len(extracted_files)} files)")
            else:
                # Not a ZIP, just rename to final name
                final_path = os.path.join(skill_dir, filename)
                os.rename(temp_path, final_path)
                print(f"Saved: {filename} ({file_size} bytes)")

        from datetime import datetime
        info_file = os.path.join(skill_dir, "skill_info.txt")
        with open(info_file, 'w', encoding='utf-8') as f:
            f.write(f"Skill ID: {SKILL_ID}\\n")
            f.write(f"Title: {SKILL_TITLE}\\n")
            f.write(f"Installed: {datetime.now().isoformat()}\\n")

        print("")
        print("=" * 50)
        print("Done! Files saved to: " + skill_dir)
        print("=" * 50)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    download_and_extract()
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(pythonScript);

  pool.execute(
    'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
    [skill.id]
  );
}

// 单个技能的安装链接 - 支持指定目录
router.get('/:id/install-link', async (req, res) => {
  try {
    const param = req.params.id;
    const targetDir = req.query.dir ? decodeURIComponent(req.query.dir) : null;

    // 先尝试用ID查找（如果是数字）
    let skill = null;
    if (/^\d+$/.test(param)) {
      const [skillsById] = await pool.execute(
        'SELECT s.id, s.title, s.slug, s.file_path, s.content, s.description, s.category, s.status FROM skills s WHERE s.id = ?',
        [parseInt(param)]
      );
      if (skillsById.length > 0) {
        skill = skillsById[0];
      }
    }

    // 如果ID没找到或者不是数字，尝试用slug或title查找
    if (!skill) {
      const [skills] = await pool.execute(
        'SELECT s.id, s.title, s.slug, s.file_path, s.content, s.description, s.category, s.status FROM skills s WHERE s.slug = ? OR s.title = ?',
        [param, param]
      );
      if (skills.length > 0) {
        skill = skills[0];
      }
    }

    if (!skill) {
      return res.status(404).send('# Error: Skill not found');
    }

    // 检查技能状态
    if (skill.status !== 'approved') {
      return res.status(403).send('# Error: 该技能未通过审核，无法安装');
    }

    const serverUrl = 'http://172.16.91.149:8080';
    const skillId = skill.id;
    const skillTitle = skill.title.replace(/"/g, '\\"');
    const targetDirCode = targetDir ? `TARGET_DIR = "${targetDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : 'TARGET_DIR = None';

    const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill Hub Installer - ${skill.title}"""

import sys
import os
import urllib.request
import shutil
import zipfile

SERVER_URL = "${serverUrl}"
SKILL_ID = ${skillId}
SKILL_TITLE = "${skillTitle}"

${targetDirCode}

def download_and_extract():
    file_url = f"{SERVER_URL}/api/skills/{SKILL_ID}/file"

    # 使用指定目录或当前目录
    if TARGET_DIR:
        target_dir = TARGET_DIR
    else:
        target_dir = os.getcwd()

    print(f"Downloading: {SKILL_TITLE}")
    print(f"Target: {target_dir}")

    try:
        skill_dir = target_dir
        os.makedirs(skill_dir, exist_ok=True)

        print("Downloading...")
        req = urllib.request.Request(file_url)
        with urllib.request.urlopen(req) as response:
            content_disp = response.headers.get('Content-Disposition', '')
            filename = SKILL_TITLE
            if 'filename=' in content_disp:
                filename = content_disp.split('filename=')[1].strip().strip('"')

            # Download to temp location
            temp_path = os.path.join(skill_dir, '_temp_' + filename)
            with open(temp_path, 'wb') as f:
                shutil.copyfileobj(response, f)

            file_size = os.path.getsize(temp_path)

            # Check if it's a ZIP file and extract
            if filename.lower().endswith('.zip') or zipfile.is_zipfile(temp_path):
                # Create extraction folder using skill title
                extract_name = SKILL_TITLE if not SKILL_TITLE.lower().endswith('.zip') else SKILL_TITLE[:-4]
                extract_dir = os.path.join(skill_dir, extract_name)
                os.makedirs(extract_dir, exist_ok=True)

                print("Extracting...")
                with zipfile.ZipFile(temp_path, 'r') as zf:
                    zf.extractall(extract_dir)

                # Remove the ZIP file after extraction
                os.remove(temp_path)

                # Count extracted files
                extracted_files = [f for f in os.listdir(extract_dir) if not f.startswith('.')]
                print(f"Extracted: {extract_name}/ ({len(extracted_files)} files)")
            else:
                # Not a ZIP, just rename to final name
                final_path = os.path.join(skill_dir, filename)
                os.rename(temp_path, final_path)
                print(f"Saved: {filename} ({file_size} bytes)")

        from datetime import datetime
        info_file = os.path.join(skill_dir, "skill_info.txt")
        with open(info_file, 'w', encoding='utf-8') as f:
            f.write(f"Skill ID: {SKILL_ID}\\n")
            f.write(f"Title: {SKILL_TITLE}\\n")
            f.write(f"Installed: {datetime.now().isoformat()}\\n")

        print("")
        print("=" * 50)
        print("Done! Files saved to: " + skill_dir)
        print("=" * 50)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    download_and_extract()
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(pythonScript);

    pool.execute(
      'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
      [skill.id]
    );
  } catch (error) {
    console.error('Install link error:', error);
    res.status(500).send('# Error: Server error');
  }
});

// 批量生成安装脚本和下载链接
router.post('/batch-install', async (req, res) => {
  try {
    const { skillIds, type = 'script' } = req.body; // type: 'script' 或 'link'

    if (!skillIds || !Array.isArray(skillIds) || skillIds.length === 0) {
      return res.status(400).json({ message: '请选择至少一个技能' });
    }

    // 查询所有选中的技能，只取approved状态
    const placeholders = skillIds.map(() => '?').join(',');
    const [skills] = await pool.execute(
      `SELECT s.id, s.title, s.slug, s.file_path, s.description, s.category, s.status
       FROM skills s
       WHERE s.id IN (${placeholders}) AND s.status = 'approved'`,
      skillIds
    );

    if (skills.length === 0) {
      return res.status(404).json({ message: '没有找到可下载的技能' });
    }

    // 过滤出有附件的技能
    const downloadableSkills = skills.filter(s => s.file_path);

    const serverUrl = 'http://172.16.91.149:8080';

    // 生成技能列表数据
    const skillDataList = downloadableSkills.map(s => `    {"id": ${s.id}, "title": "${s.title.replace(/"/g, '\\"')}"}`).join(',\n');

    // 生成下载链接（一行命令）
    const skillIdsParam = downloadableSkills.map(s => s.id).join(',');

    // 如果只请求链接，返回带目标目录的链接
    if (type === 'link') {
      const targetDir = req.body.targetDir || '';

      // 更新下载计数
      for (const skill of downloadableSkills) {
        pool.execute(
          'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
          [skill.id]
        );
      }

      // 生成带目标目录参数的链接
      let downloadLink;
      if (targetDir) {
        downloadLink = `curl -s "${serverUrl}/api/skills/batch-install-link?ids=${skillIdsParam}&dir=${encodeURIComponent(targetDir)}" | python`;
      } else {
        downloadLink = `curl -s "${serverUrl}/api/skills/batch-install-link?ids=${skillIdsParam}" | python`;
      }

      return res.json({
        link: downloadLink,
        skillCount: downloadableSkills.length,
        skills: downloadableSkills.map(s => s.title),
        targetDir: targetDir
      });
    }

    const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill Hub Batch Installer"""

import os
import sys
import urllib.request
import shutil
import argparse
import zipfile
from datetime import datetime

SERVER_URL = "${serverUrl}"

SKILLS = [
${skillDataList}
]

def download_and_extract(skill_id, skill_title, target_dir):
    """Download and extract a skill file"""
    file_url = f"{SERVER_URL}/api/skills/{skill_id}/file"
    try:
        req = urllib.request.Request(file_url)
        with urllib.request.urlopen(req) as response:
            content_disp = response.headers.get('Content-Disposition', '')
            filename = skill_title
            if 'filename=' in content_disp:
                filename = content_disp.split('filename=')[-1].strip().strip('"')

            # Download to temp location
            temp_path = os.path.join(target_dir, '_temp_' + filename)
            with open(temp_path, 'wb') as f:
                shutil.copyfileobj(response, f)

            file_size = os.path.getsize(temp_path)

            # Check if it's a ZIP file and extract
            if filename.lower().endswith('.zip') or zipfile.is_zipfile(temp_path):
                # Create extraction folder using skill title (remove .zip extension)
                extract_name = skill_title if not skill_title.lower().endswith('.zip') else skill_title[:-4]
                extract_dir = os.path.join(target_dir, extract_name)
                os.makedirs(extract_dir, exist_ok=True)

                with zipfile.ZipFile(temp_path, 'r') as zf:
                    zf.extractall(extract_dir)

                # Remove the ZIP file after extraction
                os.remove(temp_path)

                # Count extracted files
                extracted_files = [f for f in os.listdir(extract_dir) if not f.startswith('.')]
                print(f"  [OK] {skill_title} -> {extract_name}/ ({len(extracted_files)} files extracted)")
                return True, extract_name
            else:
                # Not a ZIP, just rename to final name
                final_path = os.path.join(target_dir, filename)
                os.rename(temp_path, final_path)
                print(f"  [OK] {skill_title} -> {filename} ({file_size} bytes)")
                return True, filename
    except Exception as e:
        # Cleanup temp file if exists
        temp_file = os.path.join(target_dir, '_temp_' + skill_title)
        if os.path.exists(temp_file):
            try: os.remove(temp_file)
            except: pass
        print(f"  [FAIL] {skill_title}: {e}")
        return False, str(e)

def main():
    parser = argparse.ArgumentParser(description='Skill Hub Batch Installer')
    parser.add_argument('target_dir', nargs='?', default=None,
                        help='Target directory for downloads (default: .skill in script directory)')
    args = parser.parse_args()

    # Determine target directory
    if args.target_dir:
        skill_dir = os.path.abspath(args.target_dir)
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        skill_dir = os.path.join(script_dir, ".skill")

    os.makedirs(skill_dir, exist_ok=True)

    total = len(SKILLS)
    success = 0
    failed = 0

    print("=" * 50)
    print(f"  Skill Hub Batch Installer")
    print(f"  Total: {total} skill(s)")
    print(f"  Target: {skill_dir}")
    print("=" * 50)
    print()

    for i, skill in enumerate(SKILLS, 1):
        print(f"[{i}/{total}] Downloading: {skill['title']}")
        ok, result = download_and_extract(skill['id'], skill['title'], skill_dir)
        if ok:
            success += 1
        else:
            failed += 1

    # Write install log
    log_file = os.path.join(skill_dir, "install_log.txt")
    with open(log_file, 'w', encoding='utf-8') as f:
        f.write(f"Skill Hub Batch Install Log\\n")
        f.write(f"Time: {datetime.now().isoformat()}\\n")
        f.write(f"Total: {total}\\n")
        f.write(f"Success: {success}\\n")
        f.write(f"Failed: {failed}\\n")
        f.write(f"\\nSkills:\\n")
        for skill in SKILLS:
            f.write(f"  - {skill['title']} (ID: {skill['id']})\\n")

    print()
    print("=" * 50)
    print(f"  Done! Success: {success}, Failed: {failed}")
    print(f"  Files saved to: {skill_dir}")
    print(f"  Log: {log_file}")
    print("=" * 50)

if __name__ == "__main__":
    main()
`;

    // 更新下载计数
    for (const skill of downloadableSkills) {
      pool.execute(
        'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
        [skill.id]
      );
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(pythonScript);
  } catch (error) {
    console.error('Batch install error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 批量下载链接执行接口 - 通过curl调用返回Python脚本
router.get('/batch-install-link', async (req, res) => {
  try {
    const { ids, dir } = req.query;

    if (!ids) {
      return res.status(400).send('# Error: 缺少技能ID参数');
    }

    const skillIds = ids.split(',').map(id => parseInt(id)).filter(id => id > 0);

    if (skillIds.length === 0) {
      return res.status(400).send('# Error: 无效的技能ID');
    }

    // 查询所有选中的技能，只取approved状态且有附件
    const placeholders = skillIds.map(() => '?').join(',');
    const [skills] = await pool.execute(
      `SELECT s.id, s.title, s.slug, s.file_path, s.description, s.category, s.status
       FROM skills s
       WHERE s.id IN (${placeholders}) AND s.status = 'approved' AND s.file_path IS NOT NULL`,
      skillIds
    );

    if (skills.length === 0) {
      return res.status(404).send('# Error: 没有找到可下载的技能');
    }

    const serverUrl = 'http://172.16.91.149:8080';

    // 生成技能列表数据
    const skillDataList = skills.map(s => `    {"id": ${s.id}, "title": "${s.title.replace(/"/g, '\\"')}"}`).join(',\n');

    // 如果指定了目标目录，直接写入脚本
    const targetDir = dir ? decodeURIComponent(dir) : null;
    const targetDirCode = targetDir ? `TARGET_DIR = "${targetDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : 'TARGET_DIR = None';

    const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill Hub Batch Installer"""

import os
import sys
import urllib.request
import shutil
import argparse
import zipfile
from datetime import datetime

SERVER_URL = "${serverUrl}"

${targetDirCode}

SKILLS = [
${skillDataList}
]

def download_and_extract(skill_id, skill_title, target_dir):
    """Download and extract a skill file"""
    file_url = f"{SERVER_URL}/api/skills/{skill_id}/file"
    try:
        req = urllib.request.Request(file_url)
        with urllib.request.urlopen(req) as response:
            content_disp = response.headers.get('Content-Disposition', '')
            filename = skill_title
            if 'filename=' in content_disp:
                filename = content_disp.split('filename=')[-1].strip().strip('"')

            # Download to temp location
            temp_path = os.path.join(target_dir, '_temp_' + filename)
            with open(temp_path, 'wb') as f:
                shutil.copyfileobj(response, f)

            file_size = os.path.getsize(temp_path)

            # Check if it's a ZIP file and extract
            if filename.lower().endswith('.zip') or zipfile.is_zipfile(temp_path):
                # Create extraction folder using skill title (remove .zip extension)
                extract_name = skill_title if not skill_title.lower().endswith('.zip') else skill_title[:-4]
                extract_dir = os.path.join(target_dir, extract_name)
                os.makedirs(extract_dir, exist_ok=True)

                with zipfile.ZipFile(temp_path, 'r') as zf:
                    zf.extractall(extract_dir)

                # Remove the ZIP file after extraction
                os.remove(temp_path)

                # Count extracted files
                extracted_files = [f for f in os.listdir(extract_dir) if not f.startswith('.')]
                print(f"  [OK] {skill_title} -> {extract_name}/ ({len(extracted_files)} files extracted)")
                return True, extract_name
            else:
                # Not a ZIP, just rename to final name
                final_path = os.path.join(target_dir, filename)
                os.rename(temp_path, final_path)
                print(f"  [OK] {skill_title} -> {filename} ({file_size} bytes)")
                return True, filename
    except Exception as e:
        # Cleanup temp file if exists
        temp_file = os.path.join(target_dir, '_temp_' + skill_title)
        if os.path.exists(temp_file):
            try: os.remove(temp_file)
            except: pass
        print(f"  [FAIL] {skill_title}: {e}")
        return False, str(e)

def main():
    parser = argparse.ArgumentParser(description='Skill Hub Batch Installer')
    parser.add_argument('target_dir', nargs='?', default=None,
                        help='Target directory for downloads')
    args = parser.parse_args()

    # 优先使用脚本内指定的目录，其次使用命令行参数，最后使用当前目录
    if TARGET_DIR:
        skill_dir = TARGET_DIR
    elif args.target_dir:
        skill_dir = os.path.abspath(args.target_dir)
    else:
        skill_dir = os.path.join(os.getcwd(), ".skill")

    os.makedirs(skill_dir, exist_ok=True)

    total = len(SKILLS)
    success = 0
    failed = 0

    print("=" * 50)
    print(f"  Skill Hub Batch Installer")
    print(f"  Total: {total} skill(s)")
    print(f"  Target: {skill_dir}")
    print("=" * 50)
    print()

    for i, skill in enumerate(SKILLS, 1):
        print(f"[{i}/{total}] Downloading: {skill['title']}")
        ok, result = download_and_extract(skill['id'], skill['title'], skill_dir)
        if ok:
            success += 1
        else:
            failed += 1

    log_file = os.path.join(skill_dir, "install_log.txt")
    with open(log_file, 'w', encoding='utf-8') as f:
        f.write(f"Skill Hub Batch Install Log\\n")
        f.write(f"Time: {datetime.now().isoformat()}\\n")
        f.write(f"Total: {total}\\n")
        f.write(f"Success: {success}\\n")
        f.write(f"Failed: {failed}\\n")
        f.write(f"\\nSkills:\\n")
        for skill in SKILLS:
            f.write(f"  - {skill['title']} (ID: {skill['id']})\\n")

    print()
    print("=" * 50)
    print(f"  Done! Success: {success}, Failed: {failed}")
    print(f"  Files saved to: {skill_dir}")
    print("=" * 50)
    print("=" * 50)

if __name__ == "__main__":
    main()
`;

    // 更新下载计数
    for (const skill of skills) {
      pool.execute(
        'UPDATE skills SET downloads = downloads + 1 WHERE id = ?',
        [skill.id]
      );
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(pythonScript);
  } catch (error) {
    console.error('Batch install link error:', error);
    res.status(500).send('# Error: Server error');
  }
});

// 获取当前用户的申请记录（待审核和已拒绝的）
router.get('/my-applications', authMiddleware, async (req, res) => {
  try {
    const [skills] = await pool.execute(
      `SELECT s.id, s.title, s.category, s.status, s.created_at, s.description
       FROM skills s
       WHERE s.author_id = ? AND s.status IN ('pending', 'rejected')
       ORDER BY s.created_at DESC`,
      [req.user.employee_id]
    );

    res.json({ applications: skills });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;