import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Profile() {
  const { id } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const [profileUser, setProfileUser] = useState(null)
  const [skills, setSkills] = useState([])
  const [statusStats, setStatusStats] = useState({ approved: 0, pending: 0, rejected: 0 })
  const [activeStatus, setActiveStatus] = useState('all')
  const [stats, setStats] = useState({ totalDownloads: 0, personalSkills: 0, projectSkills: 0 })
  const [loading, setLoading] = useState(true)

  const userId = id || user?.employee_id
  const isOwnProfile = user?.employee_id === userId

  // 监听路由变化，每次进入页面都刷新数据
  useEffect(() => {
    if (userId) {
      fetchProfile()
      fetchSkills()
    }
  }, [userId, location.pathname])

  useEffect(() => {
    if (userId && activeStatus) {
      fetchSkills()
    }
  }, [activeStatus, userId])

  const fetchProfile = async () => {
    try {
      const userRes = await api.get(`/users/${userId}`)
      setProfileUser(userRes.data.user)
    } catch (error) {
      console.error('Fetch profile error:', error)
    }
  }

  const fetchSkills = async () => {
    try {
      setLoading(true)
      let statusParam = ''
      if (activeStatus !== 'all') {
        statusParam = activeStatus
      }

      const skillsRes = await api.get(`/users/${userId}/skills`, {
        params: { status: statusParam, limit: 50 }
      })

      setSkills(skillsRes.data.skills || [])
      setStatusStats(skillsRes.data.statusStats || { approved: 0, pending: 0, rejected: 0 })

      // 计算统计数据（基于已通过的技能）
      if (activeStatus === 'all' || activeStatus === 'approved') {
        const approvedSkills = skillsRes.data.skills || []
        const totalDownloads = approvedSkills.reduce((sum, s) => sum + (s.downloads || 0), 0)
        const personalSkills = approvedSkills.filter(s => s.category === '个人').length
        const projectSkills = approvedSkills.filter(s => s.category === '项目').length
        setStats({ totalDownloads, personalSkills, projectSkills })
      }
    } catch (error) {
      console.error('Fetch skills error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">已通过</span>
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">审核中</span>
      case 'rejected':
        return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">已拒绝</span>
      default:
        return null
    }
  }

  if (loading && !profileUser) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!profileUser) {
    return <div className="text-center py-12">用户不存在</div>
  }

  return (
    <div className="space-y-6">
      {/* 返回首页 */}
      <div className="bg-white rounded-xl shadow-sm">
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-xl transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </Link>
      </div>

      {/* 个人资料卡片 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profileUser.username}</h1>
            <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2M9 6v2m6-2v2" />
                </svg>
                <span>工号: {profileUser.employee_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{profileUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{profileUser.department || '暂无部门'}</span>
              </div>
            </div>
          </div>
          {isOwnProfile && (
            <Link
              to="/upload"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition"
            >
              + 上传技能
            </Link>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{statusStats.approved}</div>
          <div className="text-sm text-gray-500 mt-1">已通过</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{statusStats.pending}</div>
          <div className="text-sm text-gray-500 mt-1">审核中</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{statusStats.rejected}</div>
          <div className="text-sm text-gray-500 mt-1">已拒绝</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{stats.totalDownloads}</div>
          <div className="text-sm text-gray-500 mt-1">总下载量</div>
        </div>
      </div>

      {/* 技能仓库区域 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            <svg className="w-5 h-5 inline mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            技能仓库
          </h2>
        </div>

        {/* 状态筛选 */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveStatus('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeStatus === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              全部 ({statusStats.approved + statusStats.pending + statusStats.rejected})
            </button>
            <button
              onClick={() => setActiveStatus('approved')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeStatus === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              已通过 ({statusStats.approved})
            </button>
            <button
              onClick={() => setActiveStatus('pending')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeStatus === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              审核中 ({statusStats.pending})
            </button>
            <button
              onClick={() => setActiveStatus('rejected')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeStatus === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              已拒绝 ({statusStats.rejected})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 mt-4">加载中...</p>
          </div>
        ) : skills.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">
              {activeStatus === 'all' ? '还没有上传任何技能' : `没有${activeStatus === 'approved' ? '已通过' : activeStatus === 'pending' ? '审核中' : '已拒绝'}的技能`}
            </p>
            {isOwnProfile && activeStatus === 'all' && (
              <Link to="/upload" className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium">
                上传第一个技能 →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {skills.map(skill => (
              <div
                key={skill.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition group"
              >
                {/* 技能图标 */}
                <div className="w-12 h-12 bg-gray-100 group-hover:bg-primary-50 rounded-xl flex items-center justify-center transition">
                  <svg className="w-6 h-6 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                {/* 技能信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/skill/${skill.id}`} className="font-semibold text-primary-600 hover:text-primary-700">
                      {skill.title}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      skill.category === '个人'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {skill.category}
                    </span>
                    {skill.status && getStatusBadge(skill.status)}
                    {skill.file_path && (
                      <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">
                        含附件
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">{skill.description || '暂无描述'}</p>
                </div>

                {/* 统计 */}
                <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
                  {skill.status === 'approved' && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {skill.downloads || 0}
                    </span>
                  )}
                  <span className="text-gray-400">{new Date(skill.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}