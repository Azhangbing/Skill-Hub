const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('../database/db');

const router = express.Router();

// Initialize database on first request
let dbInitialized = false;
router.use(async (req, res, next) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  next();
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, employee_id, email, password, department } = req.body;

    if (!username || !employee_id || !email || !password) {
      return res.status(400).json({ message: '用户名、工号、邮箱和密码为必填项' });
    }

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT employee_id FROM users WHERE username = ? OR email = ? OR employee_id = ?',
      [username, email, employee_id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: '用户名、邮箱或工号已存在' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await pool.execute(
      'INSERT INTO users (username, employee_id, email, password, department) VALUES (?, ?, ?, ?, ?)',
      [username, employee_id, email, hashedPassword, department || '']
    );

    // Generate token
    const token = jwt.sign(
      { employee_id, username, email },
      process.env.JWT_SECRET || 'yaxun_skill_hub_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        employee_id,
        username,
        email,
        department
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // Generate token
    const token = jwt.sign(
      { employee_id: user.employee_id, username: user.username, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET || 'yaxun_skill_hub_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        department: user.department,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT employee_id, username, email, department, role, avatar, created_at FROM users WHERE employee_id = ?',
      [req.user.employee_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;