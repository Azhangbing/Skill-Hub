const express = require('express');
const { pool } = require('../database/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 获取所有项目目录
router.get('/', async (req, res) => {
  try {
    const [projects] = await pool.query(`
      SELECT p.*, u.username as created_by_name,
             (SELECT COUNT(*) FROM skills s WHERE s.project_id = p.id) as skill_count
      FROM projects p
      JOIN users u ON p.created_by = u.employee_id
      ORDER BY p.created_at DESC
    `);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 创建新项目目录
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: '项目名称不能为空' });
    }

    const [result] = await pool.execute(
      'INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)',
      [name.trim(), description || '', req.user.employee_id]
    );

    res.status(201).json({
      message: '项目创建成功',
      project: {
        id: result.insertId,
        name: name.trim(),
        description: description || '',
        created_by: req.user.employee_id
      }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 更新项目目录
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const projectId = req.params.id;

    await pool.execute(
      'UPDATE projects SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description || '', projectId]
    );

    res.json({ message: '项目更新成功' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 删除项目目录
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;

    // 将该项目下的skills的project_id设为null
    await pool.execute('UPDATE skills SET project_id = NULL WHERE project_id = ?', [projectId]);

    // 删除项目
    await pool.execute('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({ message: '项目删除成功' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取项目下的所有skills
router.get('/:id/skills', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [skills] = await pool.query(`
      SELECT s.*, u.username as author_name, u.department as author_department
      FROM skills s
      JOIN users u ON s.author_id = u.employee_id
      WHERE s.project_id = ?
      ORDER BY s.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `, [req.params.id]);

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM skills WHERE project_id = ?',
      [req.params.id]
    );

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
    console.error('Get project skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;