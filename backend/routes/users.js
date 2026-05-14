const express = require('express');
const { pool } = require('../database/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT employee_id, username, email, department, role, avatar, created_at FROM users WHERE employee_id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's skills count - 只统计已通过的技能
    const [skillCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM skills WHERE author_id = ? AND status = ?',
      [req.params.id, 'approved']
    );

    res.json({
      user: users[0],
      skills_count: skillCount[0].count
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's skills (包含所有状态的技能)
router.get('/:id/skills', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let query = `
      SELECT s.id, s.title, s.description, s.category, s.status, s.file_path, s.downloads, s.created_at,
             u.username as author_name, u.department as author_department
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
      WHERE s.author_id = ?
    `;
    let params = [req.params.id];

    // 如果指定了status，只返回该状态的技能
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [skills] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM skills WHERE author_id = ?';
    let countParams = [req.params.id];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await pool.execute(countQuery, countParams);

    // 获取各状态的统计
    const [statusCounts] = await pool.execute(
      `SELECT status, COUNT(*) as count FROM skills WHERE author_id = ? GROUP BY status`,
      [req.params.id]
    );

    const statusStats = {
      approved: 0,
      pending: 0,
      rejected: 0
    };
    statusCounts.forEach(item => {
      statusStats[item.status] = item.count;
    });

    res.json({
      skills,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      },
      statusStats
    });
  } catch (error) {
    console.error('Get user skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { department, avatar } = req.body;

    await pool.execute(
      'UPDATE users SET department = ?, avatar = ? WHERE employee_id = ?',
      [department, avatar, req.user.employee_id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;