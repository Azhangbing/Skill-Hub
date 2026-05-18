import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Projects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data)
    } catch (error) {
      console.error('Fetch projects error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称')
      return
    }

    try {
      const res = await api.post('/projects', newProject)
      setProjects([...projects, res.data.project])
      setShowCreate(false)
      setNewProject({ name: '', description: '' })
    } catch (error) {
      alert('创建失败')
    }
  }

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`确定要删除项目 "${name}" 吗？项目下的技能会移到个人分类。`)) return
    try {
      await api.delete(`/projects/${id}`)
      fetchProjects()
    } catch (error) {
      alert('删除失败')
    }
  }

  if (!user) {
    navigate('/login')
    return null
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

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">项目目录</h2>
            <p className="text-gray-500 mt-1">点击项目查看其中的所有技能</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            + 创建新项目
          </button>
        </div>

      {/* 创建项目弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">创建新项目目录</h3>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">项目名称 *</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="例如：智能交通系统"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">项目描述</label>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                rows={3}
                placeholder="简要描述项目内容..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateProject}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">暂无项目目录</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              创建第一个项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl hover:shadow-xl transition text-white">
                <Link
                  to={`/project/${project.id}`}
                  className="block p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{project.name}</h3>
                      <p className="text-gray-300 text-sm">{project.skill_count || 0} 个技能</p>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-gray-300 text-sm line-clamp-2">{project.description}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                    <span>创建者：{project.created_by_name}</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
                {/* 删除按钮 - 创建者和管理员可见 */}
                {(user.id === project.created_by || user.role === 'admin' || user.role === 'super_admin') && (
                  <div className="px-6 pb-4 pt-2 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteProject(project.id, project.name)
                      }}
                      className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除项目
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}