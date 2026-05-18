import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('review')
  const [users, setUsers] = useState([])
  const [skills, setSkills] = useState([])
  const [comments, setComments] = useState([])
  const [pendingSkills, setPendingSkills] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [skillDetail, setSkillDetail] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  // 技能批量选择状态
  const [selectedSkillIds, setSelectedSkillIds] = useState([])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchStats()
  }, [user, navigate])

  useEffect(() => {
    if (error) return // 有错误时不继续请求
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'skills') fetchSkills()
    if (activeTab === 'comments') fetchComments()
    if (activeTab === 'review') fetchPendingSkills()
  }, [activeTab, search, error])

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data)
      setLoading(false)
    } catch (err) {
      console.error('Fetch stats error:', err)
      if (err.response?.status === 403) {
        setError('您没有此权限')
      }
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users', { params: { search } })
      setUsers(res.data.users)
    } catch (err) {
      console.error('Fetch users error:', err)
      if (err.response?.status === 403) {
        setError('您没有此权限')
      }
    }
  }

  const fetchSkills = async () => {
    try {
      const res = await api.get('/admin/skills', { params: { search } })
      setSkills(res.data.skills)
    } catch (err) {
      console.error('Fetch skills error:', err)
      if (err.response?.status === 403) {
        setError('您没有此权限')
      }
    }
  }

  const fetchComments = async () => {
    try {
      const res = await api.get('/admin/comments')
      setComments(res.data.comments)
    } catch (err) {
      console.error('Fetch comments error:', err)
      if (err.response?.status === 403) {
        setError('您没有此权限')
      }
    }
  }

  const deleteUser = async (id, username) => {
    if (!window.confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复！`)) return
    try {
      await api.delete(`/admin/users/${id}`)
      fetchUsers()
      fetchStats()
      alert('用户已删除')
    } catch (error) {
      alert('删除失败')
    }
  }

  const deleteSkill = async (id, title) => {
    if (!window.confirm(`确定要删除技能 "${title}" 吗？此操作不可恢复！`)) return
    try {
      await api.delete(`/admin/skills/${id}`)
      fetchSkills()
      fetchStats()
      alert('技能已删除')
    } catch (error) {
      alert('删除失败')
    }
  }

  // 技能批量选择功能
  const toggleSkillSelection = (id) => {
    setSelectedSkillIds(prev =>
      prev.includes(id)
        ? prev.filter(skillId => skillId !== id)
        : [...prev, skillId]
    )
  }

  const selectAllSkills = () => {
    const allIds = skills.map(s => s.id)
    setSelectedSkillIds(allIds)
  }

  const deselectAllSkills = () => {
    setSelectedSkillIds([])
  }

  const isAllSkillsSelected = () => {
    return skills.length > 0 && skills.every(s => selectedSkillIds.includes(s.id))
  }

  const deleteSelectedSkills = async () => {
    if (selectedSkillIds.length === 0) {
      alert('请先选择要删除的技能')
      return
    }
    if (!window.confirm(`确定要删除选中的 ${selectedSkillIds.length} 个技能吗？此操作不可恢复！`)) return
    try {
      // 批量删除
      for (const id of selectedSkillIds) {
        await api.delete(`/admin/skills/${id}`)
      }
      fetchSkills()
      fetchStats()
      setSelectedSkillIds([])
      alert(`已删除 ${selectedSkillIds.length} 个技能`)
    } catch (error) {
      alert('批量删除失败')
    }
  }

  const deleteComment = async (id) => {
    if (!window.confirm('确定要删除这条评论吗？')) return
    try {
      await api.delete(`/admin/comments/${id}`)
      fetchComments()
      fetchStats()
    } catch (error) {
      alert('删除失败')
    }
  }

  const setAdmin = async (id, username) => {
    if (!window.confirm(`确定要将 "${username}" 设置为管理员吗？`)) return
    try {
      await api.put(`/admin/users/${id}/admin`)
      fetchUsers()
      alert('已设置为管理员')
    } catch (error) {
      alert(error.response?.data?.message || '设置失败')
    }
  }

  const removeAdmin = async (id, username) => {
    if (!window.confirm(`确定要取消 "${username}" 的管理员权限吗？`)) return
    try {
      await api.put(`/admin/users/${id}/user`)
      fetchUsers()
      alert('已取消管理员权限')
    } catch (error) {
      alert(error.response?.data?.message || '取消失败')
    }
  }

  const fetchPendingSkills = async () => {
    try {
      const res = await api.get('/admin/pending-skills')
      setPendingSkills(res.data.skills)
    } catch (err) {
      console.error('Fetch pending skills error:', err)
      if (err.response?.status === 403) {
        setError('您没有此权限')
      }
    }
  }

  const approveSkill = async (id, title) => {
    if (!window.confirm(`确定要通过技能 "${title}" 的审核吗？`)) return
    try {
      await api.put(`/admin/skills/${id}/approve`)
      fetchPendingSkills()
      fetchStats()
      setSelectedSkill(null)
      setSkillDetail(null)
      alert('审核通过，技能已发布')
    } catch (error) {
      alert(error.response?.data?.message || '操作失败')
    }
  }

  const rejectSkill = async (id, title) => {
    if (!window.confirm(`确定要拒绝技能 "${title}" 的审核吗？`)) return
    try {
      await api.put(`/admin/skills/${id}/reject`)
      fetchPendingSkills()
      fetchStats()
      setSelectedSkill(null)
      setSkillDetail(null)
      alert('已拒绝该技能申请')
    } catch (error) {
      alert(error.response?.data?.message || '操作失败')
    }
  }

  const viewSkillDetail = async (id) => {
    try {
      const res = await api.get(`/admin/pending-skills/${id}`)
      setSkillDetail(res.data.skill)
      setSelectedSkill(id)
      setFileContent(null)
    } catch (error) {
      alert('获取详情失败')
    }
  }

  const previewFile = async () => {
    if (!skillDetail?.file_path) return
    setFileLoading(true)
    try {
      const res = await api.get(`/skills/${skillDetail.id}/file`, {
        responseType: 'text'
      })
      setFileContent(res.data)
    } catch (error) {
      setFileContent('无法加载文件内容')
    } finally {
      setFileLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedSkill(null)
    setSkillDetail(null)
    setFileContent(null)
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">权限不足</h2>
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <p className="text-gray-500 text-sm mb-6">只有管理员才能访问管理后台</p>
          <Link to="/" className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-64 bg-gradient-to-b from-primary-600 to-primary-700 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl">
        <div className="p-5 border-b border-primary-500/30">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
            </div>
            <div>
              <p className="font-bold text-lg">雅迅智联</p>
              <p className="text-xs text-primary-200">厦门雅迅智联科技</p>
            </div>
          </Link>
        </div>
        <div className="flex-1 py-6 px-3">
          <div className="px-4">
            <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-primary-100 hover:bg-white/10 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              返回首页
            </Link>
          </div>
        </div>
        <div className="p-4 border-t border-primary-500/30">
          <p className="text-sm text-primary-200 px-4">
            {user?.role === 'super_admin' ? '主管理员' : '管理员'}：{user?.username}
          </p>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* 顶部标题栏 */}
        <header className="bg-primary-600 h-16 flex items-center px-8 shadow-lg fixed top-0 left-64 right-0 z-40">
          <h1 className="text-3xl font-bold text-white tracking-wide">雅迅技能管理平台</h1>
        </header>

        <main className="flex-1 p-6 mt-16">
          <h2 className="text-xl font-bold text-gray-800 mb-6">管理后台</h2>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('review')}
                className={`px-6 py-3 font-medium ${activeTab === 'review' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              >
                技能审核
                {pendingSkills.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingSkills.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-3 font-medium ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              >
                用户管理
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`px-6 py-3 font-medium ${activeTab === 'skills' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              >
                技能管理
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-6 py-3 font-medium ${activeTab === 'comments' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              >
                评论管理
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search */}
            {(activeTab === 'users' || activeTab === 'skills') && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="搜索..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-4 py-2 border rounded-lg w-64"
                />
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && (
              <div>
                {/* 详情弹窗 */}
                {selectedSkill && skillDetail && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">审核详情</h3>
                        <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-gray-500">标题</label>
                          <p className="font-semibold text-gray-800">{skillDetail.title}</p>
                        </div>

                        <div>
                          <label className="text-sm text-gray-500">分类</label>
                          <span className={`ml-2 px-2 py-0.5 rounded text-sm ${
                            skillDetail.category === '个人' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {skillDetail.category}
                          </span>
                        </div>

                        <div>
                          <label className="text-sm text-gray-500">作者</label>
                          <p className="text-gray-800">
                            {skillDetail.author_name}
                            {skillDetail.author_department && ` (${skillDetail.author_department})`}
                          </p>
                        </div>

                        <div>
                          <label className="text-sm text-gray-500">描述</label>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded">{skillDetail.description || '暂无描述'}</p>
                        </div>

                        {skillDetail.content && (
                          <div>
                            <label className="text-sm text-gray-500">代码内容</label>
                            <pre className="text-gray-700 bg-gray-50 p-3 rounded font-mono text-sm overflow-x-auto whitespace-pre-wrap max-h-96">
                              {skillDetail.content}
                            </pre>
                          </div>
                        )}

                        <div>
                          <label className="text-sm text-gray-500">附件</label>
                          {skillDetail.file_path ? (
                            <div className="mt-2">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-green-600 font-medium">有附件文件</span>
                                <button
                                  onClick={previewFile}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
                                >
                                  {fileContent ? '隐藏预览' : '预览文件'}
                                </button>
                              </div>
                              {fileContent && (
                                <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm overflow-auto max-h-96">
                                  {fileLoading ? (
                                    <div className="text-center py-4">加载中...</div>
                                  ) : (
                                    <pre className="whitespace-pre-wrap">{fileContent}</pre>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">无附件</span>
                          )}
                        </div>

                        <div>
                          <label className="text-sm text-gray-500">提交时间</label>
                          <p className="text-gray-700">{new Date(skillDetail.created_at).toLocaleDateString('zh-CN')}</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button
                          onClick={() => approveSkill(skillDetail.id, skillDetail.title)}
                          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                        >
                          通过审核
                        </button>
                        <button
                          onClick={() => rejectSkill(skillDetail.id, skillDetail.title)}
                          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                        >
                          拒绝申请
                        </button>
                        <button
                          onClick={closeDetail}
                          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {pendingSkills.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>暂无待审核的技能</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingSkills.map(skill => (
                      <div key={skill.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-800">{skill.title}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                skill.category === '个人' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {skill.category}
                              </span>
                              {skill.file_path && (
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                  含附件
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-2">{skill.description || '暂无描述'}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {skill.author_name}
                                {skill.author_department && ` (${skill.author_department})`}
                              </span>
                              <span>
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(skill.created_at).toLocaleDateString('zh-CN')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => viewSkillDetail(skill.id)}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                            >
                              查看详情
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">工号</th>
                      <th className="px-4 py-2 text-left">用户名</th>
                      <th className="px-4 py-2 text-left">邮箱</th>
                      <th className="px-4 py-2 text-left">部门</th>
                      <th className="px-4 py-2 text-left">技能数</th>
                      <th className="px-4 py-2 text-left">注册时间</th>
                      <th className="px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.employee_id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{u.employee_id}</td>
                        <td className="px-4 py-2 font-medium">
                          {u.username}
                          {u.role === 'super_admin' && (
                            <span className="ml-2 text-xs text-red-500 font-medium">(主管理员)</span>
                          )}
                          {u.role === 'admin' && (
                            <span className="ml-2 text-xs text-orange-500 font-medium">(管理员)</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{u.email}</td>
                        <td className="px-4 py-2">{u.department || '-'}</td>
                        <td className="px-4 py-2">{u.skill_count}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          {/* 只有主管理员可以设置/取消管理员 */}
                          {user?.role === 'super_admin' && u.role !== 'super_admin' && (
                            u.role === 'admin' ? (
                              <button
                                onClick={() => removeAdmin(u.employee_id, u.username)}
                                className="text-orange-500 hover:text-orange-700 mr-2"
                              >
                                取消管理员
                              </button>
                            ) : (
                              <button
                                onClick={() => setAdmin(u.employee_id, u.username)}
                                className="text-blue-500 hover:text-blue-700 mr-2"
                              >
                                设为管理员
                              </button>
                            )
                          )}
                          <button
                            onClick={() => deleteUser(u.employee_id, u.username)}
                            className="text-red-500 hover:text-red-700"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === 'skills' && (
              <div>
                {/* 批量操作工具栏 */}
                <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-700">
                      已选择 {selectedSkillIds.length} 个技能
                    </span>
                    <button
                      onClick={isAllSkillsSelected() ? deselectAllSkills : selectAllSkills}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {isAllSkillsSelected() ? '取消全选' : '全选'}
                    </button>
                    <button
                      onClick={deselectAllSkills}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      清空选择
                    </button>
                  </div>
                  {selectedSkillIds.length > 0 && (
                    <button
                      onClick={deleteSelectedSkills}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      批量删除 ({selectedSkillIds.length})
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left w-8">
                          <input
                            type="checkbox"
                            checked={isAllSkillsSelected()}
                            onChange={isAllSkillsSelected() ? deselectAllSkills : selectAllSkills}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </th>
                        <th className="px-4 py-2 text-left">标题</th>
                        <th className="px-4 py-2 text-left">分类</th>
                        <th className="px-4 py-2 text-left">作者</th>
                        <th className="px-4 py-2 text-left">下载</th>
                        <th className="px-4 py-2 text-left">评论</th>
                        <th className="px-4 py-2 text-left">附件</th>
                        <th className="px-4 py-2 text-left">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skills.map(s => (
                        <tr key={s.id} className={`border-b hover:bg-gray-50 ${selectedSkillIds.includes(s.id) ? 'bg-primary-50' : ''}`}>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedSkillIds.includes(s.id)}
                              onChange={() => toggleSkillSelection(s.id)}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-4 py-2 font-medium">
                            <a href={`/skill/${s.id}`} className="text-primary-600 hover:underline" target="_blank">
                              {s.title}
                            </a>
                          </td>
                          <td className="px-4 py-2">
                            <span className="bg-primary-100 text-primary-600 px-2 py-1 rounded text-sm">
                              {s.category}
                            </span>
                          </td>
                          <td className="px-4 py-2">{s.author_name}</td>
                          <td className="px-4 py-2">{s.downloads}</td>
                          <td className="px-4 py-2">{s.comment_count}</td>
                          <td className="px-4 py-2">
                            {s.file_path ? '✓' : '-'}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => deleteSkill(s.id, s.title)}
                              className="text-red-500 hover:text-red-700"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{c.user_name}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          评论于 "{c.skill_title}"
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-700">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}