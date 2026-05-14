import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const categories = ['个人', '项目']

export default function Upload() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [uploadMode, setUploadMode] = useState('single') // 'single' or 'batch'
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '个人',
    project_id: ''
  })
  const [projects, setProjects] = useState([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  // 批量上传状态
  const [batchFiles, setBatchFiles] = useState([])
  const [batchCategory, setBatchCategory] = useState('个人')
  const [batchProjectId, setBatchProjectId] = useState('')
  const [batchDescription, setBatchDescription] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState(null)

  // 加载项目列表和URL参数
  useEffect(() => {
    fetchProjects()

    // 从URL参数获取project_id和category
    const projectIdParam = searchParams.get('project_id')
    const categoryParam = searchParams.get('category')

    if (projectIdParam) {
      // 如果从项目详情页跳转，自动设置为批量上传模式
      setUploadMode('batch')
      setBatchCategory(categoryParam || '项目')
      setBatchProjectId(projectIdParam)
      setForm({ ...form, category: '项目', project_id: projectIdParam })
    }
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data)
    } catch (error) {
      console.error('Fetch projects error:', error)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    // 如果切换分类，清空project_id
    if (e.target.name === 'category' && e.target.value === '个人') {
      setForm({ ...form, category: '个人', project_id: '' })
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setResult({ success: false, message: '文件大小超过50MB限制' })
        return
      }
      setFile(selectedFile)
    }
  }

  // 创建新项目目录
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('请输入项目名称')
      return
    }

    try {
      const res = await api.post('/projects', {
        name: newProjectName,
        description: newProjectDesc
      })
      // 添加到列表并选中
      setProjects([...projects, res.data.project])
      setForm({ ...form, project_id: res.data.project.id })
      setShowNewProject(false)
      setNewProjectName('')
      setNewProjectDesc('')
    } catch (error) {
      alert('创建项目失败')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setResult(null)
    setLoading(true)

    if (!form.title.trim()) {
      setResult({ success: false, message: '请输入标题' })
      setLoading(false)
      return
    }

    if (form.category === '项目' && !form.project_id) {
      setResult({ success: false, message: '请选择或创建项目目录' })
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('category', form.category)
      formData.append('project_id', form.project_id)
      if (file) {
        formData.append('file', file)
      }

      const response = await api.post('/skills', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      })

      const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
      const status = response.data.status

      setResult({
        success: true,
        message: response.data.message,
        status: status,
        isAdmin: isAdmin,
        skillId: response.data.skill.id,
        skillTitle: response.data.skill.title,
        hasFile: response.data.skill.file_path
      })

      // 清空表单
      setForm({ title: '', description: '', category: '个人', project_id: '' })
      setFile(null)

    } catch (error) {
      console.error('Upload error:', error)
      let message = '上传失败，请重试'
      if (error.response?.data?.message) {
        message = error.response.data.message
      } else if (error.code === 'ECONNABORTED') {
        message = '上传超时，请检查网络连接'
      } else if (!localStorage.getItem('token')) {
        message = '请先登录后再上传'
      }
      setResult({ success: false, message })
    } finally {
      setLoading(false)
    }
  }

  const goToSkill = () => {
    if (result?.skillId) {
      navigate(`/skill/${result.skillId}`)
    }
  }

  const goToHome = () => {
    navigate('/')
  }

  const uploadAnother = () => {
    setResult(null)
    setForm({ title: '', description: '', category: '个人', project_id: '' })
    setFile(null)
  }

  // 批量上传：选择多个文件（追加模式）
  const handleBatchFilesChange = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024)
    const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024)

    if (oversizedFiles.length > 0) {
      alert(`以下文件超过50MB限制：${oversizedFiles.map(f => f.name).join(', ')}`)
    }

    // 为每个文件生成默认标题（去掉扩展名），追加到现有列表
    const filesWithTitles = validFiles.map(f => ({
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''), // 去掉扩展名
      id: Date.now() + Math.random()
    }))
    setBatchFiles(prev => [...prev, ...filesWithTitles])
  }

  // 修改批量文件标题
  const updateBatchFileTitle = (id, title) => {
    setBatchFiles(batchFiles.map(f => f.id === id ? { ...f, title } : f))
  }

  // 移除批量文件
  const removeBatchFile = (id) => {
    setBatchFiles(batchFiles.filter(f => f.id !== id))
  }

  // 批量上传提交
  const handleBatchSubmit = async (e) => {
    e.preventDefault()
    setBatchResult(null)
    setBatchLoading(true)

    if (batchFiles.length === 0) {
      setBatchResult({ success: false, message: '请选择要上传的文件' })
      setBatchLoading(false)
      return
    }

    if (batchCategory === '项目' && !batchProjectId) {
      setBatchResult({ success: false, message: '请选择项目目录' })
      setBatchLoading(false)
      return
    }

    try {
      const formData = new FormData()

      // 添加所有文件
      batchFiles.forEach(item => {
        formData.append('files', item.file)
        formData.append('titles', item.title)
      })

      formData.append('category', batchCategory)
      formData.append('project_id', batchProjectId || '')
      formData.append('description', batchDescription)

      const response = await api.post('/skills/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      })

      setBatchResult({
        success: true,
        message: response.data.message,
        results: response.data.results,
        successCount: response.data.successCount,
        failCount: response.data.failCount
      })

      // 清空
      setBatchFiles([])
      setBatchDescription('')

    } catch (error) {
      console.error('Batch upload error:', error)
      setBatchResult({
        success: false,
        message: error.response?.data?.message || '批量上传失败，请重试'
      })
    } finally {
      setBatchLoading(false)
    }
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
        <h2 className="text-xl font-bold text-gray-800 mb-6">上传新技能</h2>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setUploadMode('single')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              uploadMode === 'single'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            单个上传
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('batch')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              uploadMode === 'batch'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            批量上传
          </button>
        </div>

      {/* 结果提示弹窗 */}
      {result && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
          <div className={`bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 ${result.success ? (result.status === 'pending' ? 'border-t-4 border-yellow-500' : 'border-t-4 border-green-500') : 'border-t-4 border-red-500'}`}>
            <div className="text-center">
              {result.success ? (
                <>
                  {/* 管理员直接通过 */}
                  {result.isAdmin ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-green-600 mb-2">上传成功！</h3>
                      <p className="text-gray-600 mb-2">
                        技能 "<strong>{result.skillTitle}</strong>" 已成功上传
                      </p>
                      {result.hasFile && (
                        <p className="text-green-600 text-sm mb-4">✓ 包含附件文件</p>
                      )}
                    </>
                  ) : (
                    /* 普通用户等待审核 */
                    <>
                      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-yellow-600 mb-2">申请已提交</h3>
                      <p className="text-gray-600 mb-2">
                        上传申请已提交，等待管理员审核
                      </p>
                      <p className="text-yellow-600 text-sm mb-4">
                        技能 "<strong>{result.skillTitle}</strong>" 审核通过后将在首页显示
                      </p>
                      <p className="text-gray-500 text-xs mb-4">
                        可在「个人信息」页面查看审核状态
                      </p>
                    </>
                  )}
                  <div className="flex gap-3 justify-center mt-6">
                    {result.isAdmin && (
                      <button
                        onClick={goToSkill}
                        className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
                      >
                        查看详情
                      </button>
                    )}
                    <button
                      onClick={goToHome}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                    >
                      返回首页
                    </button>
                    <button
                      onClick={uploadAnother}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                    >
                      继续上传
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-red-600 mb-2">上传失败</h3>
                  <p className="text-gray-600 mb-6">{result.message}</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setResult(null)}
                      className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
                    >
                      重新上传
                    </button>
                    <button
                      onClick={goToHome}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                    >
                      返回首页
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 单个上传表单 */}
      {uploadMode === 'single' && (
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2 font-medium">标题 *</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="请输入技能名称"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2 font-medium">分类 *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* 项目目录选择 - 仅在选择"项目"分类时显示 */}
        {form.category === '项目' && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-gray-700 mb-2 font-medium">
              项目目录 *（选择或创建项目来存放此技能）
            </label>

            {!showNewProject ? (
              <div className="flex gap-3">
                <select
                  name="project_id"
                  value={form.project_id}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- 选择项目目录 --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.skill_count || 0} 个技能)</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewProject(true)}
                  className="bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition"
                >
                  + 新建项目
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="输入新项目名称"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="项目描述（可选）"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    创建项目
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProject(false)
                      setNewProjectName('')
                      setNewProjectDesc('')
                    }}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {form.project_id && projects.find(p => p.id === parseInt(form.project_id)) && (
              <p className="mt-2 text-sm text-blue-600">
                当前选中：{projects.find(p => p.id === parseInt(form.project_id))?.name}
              </p>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 mb-2 font-medium">描述</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            placeholder="请描述这个技能的作用和使用方法..."
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2 font-medium">
            附件文件（可选）
          </label>
          <p className="text-sm text-gray-500 mb-3">
            支持的文件类型：压缩文件 (zip, rar, tar, gz)、文档 (pdf, doc, docx)、文本 (md, txt, json)、代码 (js, ts, py, java, cpp, sql 等)、图片 (png, jpg, gif)。最大 50MB。
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary-500 transition text-center">
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="file-input"
              accept=".zip,.rar,.tar,.gz,.pdf,.doc,.docx,.md,.txt,.json,.js,.ts,.py,.java,.cpp,.c,.h,.sql,.xml,.yaml,.yml,.sh,.bat,.png,.jpg,.jpeg,.gif,.svg,.html,.css,.vue,.jsx,.tsx,.go,.rs,.rb,.php,.swift,.kt"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600">点击选择文件或拖拽文件到此处</p>
            </label>
            {file && (
              <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{file.name}</span>
                <span className="text-gray-500 text-sm">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.121 5.826 3 7.938l3-2.647z"></path>
              </svg>
              上传中...
            </>
          ) : (
            '上传技能'
          )}
        </button>
      </form>
      )}

      {/* 批量上传表单 */}
      {uploadMode === 'batch' && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleBatchSubmit}>
            {/* 文件选择 */}
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-medium">
                选择文件（可多选）*
              </label>
              <p className="text-sm text-gray-500 mb-3">
                支持的文件类型：压缩文件、文档、文本、代码、图片等。每个文件最大 50MB。
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary-500 transition text-center">
                <input
                  type="file"
                  onChange={handleBatchFilesChange}
                  className="hidden"
                  id="batch-file-input"
                  multiple
                  accept=".zip,.rar,.tar,.gz,.pdf,.doc,.docx,.md,.txt,.json,.js,.ts,.py,.java,.cpp,.c,.h,.sql,.xml,.yaml,.yml,.sh,.bat,.png,.jpg,.jpeg,.gif,.svg,.html,.css,.vue,.jsx,.tsx,.go,.rs,.rb,.php,.swift,.kt"
                />
                <label htmlFor="batch-file-input" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600">点击选择多个文件</p>
                </label>
              </div>
            </div>

            {/* 已选择的文件列表 */}
            {batchFiles.length > 0 && (
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">
                  已选择 {batchFiles.length} 个文件（可编辑标题）
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batchFiles.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateBatchFileTitle(item.id, e.target.value)}
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="技能标题"
                      />
                      <span className="text-sm text-gray-500">
                        ({(item.file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBatchFile(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分类 */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2 font-medium">分类 *</label>
              <select
                value={batchCategory}
                onChange={(e) => {
                  setBatchCategory(e.target.value)
                  if (e.target.value === '个人') setBatchProjectId('')
                }}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 项目目录选择 */}
            {batchCategory === '项目' && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="block text-gray-700 mb-2 font-medium">项目目录 *</label>
                <select
                  value={batchProjectId}
                  onChange={(e) => setBatchProjectId(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- 选择项目目录 --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 统一描述 */}
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-medium">统一描述（应用到所有技能）</label>
              <textarea
                value={batchDescription}
                onChange={(e) => setBatchDescription(e.target.value)}
                rows={3}
                placeholder="可选，为所有上传的技能添加统一描述..."
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={batchLoading || batchFiles.length === 0}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {batchLoading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.121 5.826 3 7.938l3-2.647z"></path>
                  </svg>
                  批量上传中...
                </>
              ) : (
                `批量上传 ${batchFiles.length} 个技能`
              )}
            </button>
          </form>

          {/* 批量上传结果 */}
          {batchResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
                <div className="text-center mb-4">
                  {batchResult.success ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-green-600 mb-2">批量上传完成</h3>
                      <p className="text-gray-600">
                        成功: {batchResult.successCount} 个，失败: {batchResult.failCount} 个
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-red-600 mb-2">批量上传失败</h3>
                      <p className="text-gray-600">{batchResult.message}</p>
                    </>
                  )}
                </div>

                {batchResult.results && batchResult.results.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">上传详情：</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {batchResult.results.map((r, i) => (
                        <div key={i} className={`p-2 rounded ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className={r.success ? 'text-green-600' : 'text-red-600'}>
                            {r.success ? '✓' : '✗'} {r.title}
                          </span>
                          {!r.success && <span className="text-red-500 text-sm ml-2">({r.error})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setBatchResult(null)}
                    className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
                  >
                    继续上传
                  </button>
                  <button
                    onClick={goToHome}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    返回首页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  )
}