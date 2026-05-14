const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 简��的管理员验证（可以根据需要扩展）
// 管理员验证中间件（支持主管理员和分支管理员）
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: '您没有此权限' });
  }
  next();
};

// 主管理员验证中间件（仅主管理员）
const superAdminMiddleware = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: '此操作仅主管理员可执行' });
  }
  next();
};

// 获取统计数据
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // 用户总数
    const [userCount] = await pool.query('SELECT COUNT(*) as total FROM users');

    // 技能总数
    const [skillCount] = await pool.query('SELECT COUNT(*) as total FROM skills');

    // 评论总数
    const [commentCount] = await pool.query('SELECT COUNT(*) as total FROM comments');

    // 下载总数
    const [downloadCount] = await pool.query('SELECT SUM(downloads) as total FROM skills');

    // 各分类技能数量
    const [categoryStats] = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM skills
      GROUP BY category
    `);

    // 最近7天新增用户
    const [newUsers] = await pool.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // 最近7天新增技能
    const [newSkills] = await pool.query(`
      SELECT COUNT(*) as count
      FROM skills
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    res.json({
      users: userCount[0].total,
      skills: skillCount[0].total,
      comments: commentCount[0].total,
      downloads: downloadCount[0].total || 0,
      categoryStats,
      newUsers: newUsers[0].count,
      newSkills: newSkills[0].count
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取所有用户列表
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.employee_id, u.username, u.email, u.department, u.role, u.created_at,
             COUNT(s.id) as skill_count
      FROM users u
      LEFT JOIN skills s ON u.employee_id = s.author_id AND s.status = 'approved'
    `;
    let params = [];

    if (search) {
      query += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.department LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY u.employee_id ORDER BY u.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const [users] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    if (search) {
      countQuery += ' WHERE username LIKE ? OR email LIKE ? OR department LIKE ?';
    }
    const [countResult] = await pool.query(countQuery, params);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取所有技能列表（管理员视角）- 只显示已审核通过的
router.get('/skills', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT s.id, s.title, s.category, s.downloads, s.file_path, s.created_at, s.status,
             u.username as author_name, u.department as author_department,
             (SELECT COUNT(*) FROM comments c WHERE c.skill_id = s.id) as comment_count
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
    `;
    let conditions = ['s.status = ?'];
    let params = ['approved'];

    if (search) {
      conditions.push('(s.title LIKE ? OR u.username LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      conditions.push('s.category = ?');
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY s.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const [skills] = await pool.query(query, params);

    // 获取总数 - 只统计已审核通过的
    let countQuery = 'SELECT COUNT(*) as total FROM skills s JOIN users u ON s.author_id = u.employee_id WHERE s.status = ?';
    let countParams = ['approved'];
    if (search) {
      countQuery += ' AND (s.title LIKE ? OR u.username LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      countQuery += ' AND s.category = ?';
      countParams.push(category);
    }
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      skills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 管理员删除用户
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    // 删除用户的技能和评论
    await pool.query('DELETE FROM comments WHERE user_id = ?', [userId]);

    // 获取用户的所有技能文件并删除
    const [skills] = await pool.query('SELECT file_path FROM skills WHERE author_id = ?', [userId]);
    skills.forEach(skill => {
      if (skill.file_path) {
        const filePath = path.join(__dirname, '../..', skill.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    await pool.query('DELETE FROM skills WHERE author_id = ?', [userId]);

    // 删除用户创建的项目
    await pool.query('DELETE FROM projects WHERE created_by = ?', [userId]);

    await pool.query('DELETE FROM users WHERE employee_id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 管理员删除技能
router.delete('/skills/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skillId = req.params.id;

    // 获取技能文件
    const [skills] = await pool.query('SELECT file_path FROM skills WHERE id = ?', [skillId]);

    // 删除评论
    await pool.query('DELETE FROM comments WHERE skill_id = ?', [skillId]);

    // 删除技能
    await pool.query('DELETE FROM skills WHERE id = ?', [skillId]);

    // 删除文件
    if (skills[0] && skills[0].file_path) {
      const fs = require('fs');
      const path = require('path');
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

// 获取所有评论
router.get('/comments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [comments] = await pool.query(`
      SELECT c.id, c.content, c.created_at,
             u.username as user_name,
             s.title as skill_title
      FROM comments c
      JOIN users u ON c.user_id = u.employee_id
      JOIN skills s ON c.skill_id = s.id
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM comments');

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 删除评论
router.delete('/comments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 设置用户为分支管理员（仅主管理员可操作）
router.put('/users/:id/admin', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    // 检查用户是否存在
    const [users] = await pool.query('SELECT employee_id, role FROM users WHERE employee_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 不能修改主管理员
    if (users[0].role === 'super_admin') {
      return res.status(400).json({ message: '不能修改主管理员权限' });
    }

    // 设置为分支管理员
    await pool.query('UPDATE users SET role = ? WHERE employee_id = ?', ['admin', userId]);

    res.json({ message: '已设置为分支管理员', user: { employee_id: userId, role: 'admin' } });
  } catch (error) {
    console.error('Set admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 取消用户的管理员权限（仅主管理员可操作）
router.put('/users/:id/user', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    // 检查用户是否存在
    const [users] = await pool.query('SELECT employee_id, role FROM users WHERE employee_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 不能修改主管理员
    if (users[0].role === 'super_admin') {
      return res.status(400).json({ message: '不能修改主管理员权限' });
    }

    // 取消管理员权限
    await pool.query('UPDATE users SET role = ? WHERE employee_id = ?', ['user', userId]);

    res.json({ message: '已取消管理员权限', user: { employee_id: userId, role: 'user' } });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取待审核的技能列表
router.get('/pending-skills', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [skills] = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.status, s.created_at, s.file_path,
             u.username as author_name, u.department as author_department
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
      WHERE s.status = 'pending'
      ORDER BY s.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM skills WHERE status = ?', ['pending']);

    res.json({
      skills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get pending skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取待审核技能详情（管理员查看）
router.get('/pending-skills/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skillId = req.params.id;

    const [skills] = await pool.query(`
      SELECT s.*, u.username as author_name, u.department as author_department, u.email as author_email
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
      WHERE s.id = ?
    `, [skillId]);

    if (skills.length === 0) {
      return res.status(404).json({ message: '技能不存在' });
    }

    res.json({ skill: skills[0] });
  } catch (error) {
    console.error('Get pending skill detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 审核通过技能
router.put('/skills/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skillId = req.params.id;

    const [skills] = await pool.query('SELECT id, status FROM skills WHERE id = ?', [skillId]);
    if (skills.length === 0) {
      return res.status(404).json({ message: '技能不存在' });
    }

    if (skills[0].status !== 'pending') {
      return res.status(400).json({ message: '该技能不在待审核状态' });
    }

    await pool.query('UPDATE skills SET status = ? WHERE id = ?', ['approved', skillId]);

    res.json({ message: '审核通过', skill: { id: skillId, status: 'approved' } });
  } catch (error) {
    console.error('Approve skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 审核拒绝技能
router.put('/skills/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skillId = req.params.id;

    const [skills] = await pool.query('SELECT id, status, file_path FROM skills WHERE id = ?', [skillId]);
    if (skills.length === 0) {
      return res.status(404).json({ message: '技能不存在' });
    }

    if (skills[0].status !== 'pending') {
      return res.status(400).json({ message: '该技能不在待审核状态' });
    }

    // 更新状态为拒绝
    await pool.query('UPDATE skills SET status = ? WHERE id = ?', ['rejected', skillId]);

    res.json({ message: '已拒绝', skill: { id: skillId, status: 'rejected' } });
  } catch (error) {
    console.error('Reject skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;