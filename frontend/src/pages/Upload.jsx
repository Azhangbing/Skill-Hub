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

  // 单个上传 - 文件夹选择状态
  const [folderFiles, setFolderFiles] = useState([])
  const [folderName, setFolderName] = useState('')

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

    const projectIdParam = searchParams.get('project_id')
    const categoryParam = searchParams.get('category')

    if (projectIdParam) {
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
    if (e.target.name === 'category' && e.target.value === '个人') {
      setForm({ ...form, category: '个人', project_id: '' })
    }
  }

  // 单个上传 - 选择文件
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setResult({ success: false, message: '文件大小超过50MB限制' })
        return
      }
      setFile(selectedFile)
      setFolderFiles([])
      setFolderName('')
    }
  }

  // 单个上传 - 选择文件夹
  const handleFolderChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024)
    const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024)

    if (oversizedFiles.length > 0) {
      alert(`以下文件超过50MB限制：${oversizedFiles.map(f => f.name).join(', ')}`)
    }

    const folderNameFromPath = files[0].webkitRelativePath.split('/')[0]
    setFolderFiles(validFiles)
    setFolderName(folderNameFromPath)
    setFile(null)
    if (!form.title) {
      setForm(prev => ({ ...prev, title: folderNameFromPath }))
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
      setProjects([...projects, res.data.project])
      setForm({ ...form, project_id: res.data.project.id })
      setShowNewProject(false)
      setNewProjectName('')
      setNewProjectDesc('')
    } catch (error) {
      alert('创建项目失败')
    }
  }

  // 单个上传提交
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

    if (!file && folderFiles.length === 0) {
      setResult({ success: false, message: '请选择文件或文件夹' })
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('category', form.category)
      formData.append('project_id', form.project_id)

      if (folderFiles.length > 0) {
        // 文件夹上传
        formData.append('isFolder', 'true')
        folderFiles.forEach(f => {
          formData.append('files', f)
          formData.append('relativePaths', f.webkitRelativePath)
        })

        const response = await api.post('/skills/folder', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000
        })

        const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
        setResult({
          success: true,
          message: response.data.message,
          status: response.data.status,
          isAdmin: isAdmin,
          skillId: response.data.skill.id,
          skillTitle: response.data.skill.title,
          hasFile: response.data.skill.file_path,
          isFolder: true,
          fileCount: folderFiles.length
        })
      } else if (file) {
        // 单文件上传
        formData.append('file', file)

        const response = await api.post('/skills', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000
        })

        const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
        setResult({
          success: true,
          message: response.data.message,
          status: response.data.status,
          isAdmin: isAdmin,
          skillId: response.data.skill.id,
          skillTitle: response.data.skill.title,
          hasFile: response.data.skill.file_path
        })
      }

      setForm({ title: '', description: '', category: '个人', project_id: '' })
      setFile(null)
      setFolderFiles([])
      setFolderName('')

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
    setFolderFiles([])
    setFolderName('')
  }

  // 批量上传：选择多个文件
  const handleBatchFilesChange = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024)
    const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024)

    if (oversizedFiles.length > 0) {
      alert(`以下文件超过50MB限制：${oversizedFiles.map(f => f.name).join(', ')}`)
    }

    const filesWithTitles = validFiles.map(f => ({
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''),
      id: Date.now() + Math.random(),
      isFolder: false
    }))
    setBatchFiles(prev => [...prev, ...filesWithTitles])
  }

  // 批量上传：选择文件夹（作为单个技能）
  const handleBatchFolderChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024)
    const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024)

    if (oversizedFiles.length > 0) {
      alert(`以下文件超过50MB限制：${oversizedFiles.map(f => f.name).join(', ')}`)
    }

    const folderNameFromPath = files[0].webkitRelativePath.split('/')[0]

    // 将文件夹作为一个技能添加到批量列表
    setBatchFiles(prev => [...prev, {
      file: validFiles,
      title: folderNameFromPath,
      id: Date.now() + Math.random(),
      isFolder: true,
      relativePaths: validFiles.map(f => f.webkitRelativePath)
    }])
  }

  const updateBatchFileTitle = (id, title) => {
    setBatchFiles(batchFiles.map(f => f.id === id ? { ...f, title } : f))
  }

  const removeBatchFile = (id) => {
    setBatchFiles(batchFiles.filter(f => f.id !== id))
  }

  // 批量上传提交
  const handleBatchSubmit = async (e) => {
    e.preventDefault()
    setBatchResult(null)
    setBatchLoading(true)

    if (batchFiles.length === 0) {
      setBatchResult({ success: false, message: '请选择要上传的文件或文件夹' })
      setBatchLoading(false)
      return
    }

    if (batchCategory === '项目' && !batchProjectId) {
      setBatchResult({ success: false, message: '请选择项目目录' })
      setBatchLoading(false)
      return
    }

    try {
      let successCount = 0
      let failCount = 0
      const results = []

      // 逐个上传
      for (const item of batchFiles) {
        try {
          const formData = new FormData()
          formData.append('title', item.title)
          formData.append('category', batchCategory)
          formData.append('project_id', batchProjectId || '')
          formData.append('description', batchDescription)

          if (item.isFolder) {
            // 文件夹上传
            formData.append('isFolder', 'true')
            item.file.forEach(f => {
              formData.append('files', f)
              formData.append('relativePaths', f.webkitRelativePath)
            })

            const response = await api.post('/skills/folder', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 180000
            })
            results.push({ title: item.title, success: true, isFolder: true, fileCount: item.file.length })
            successCount++
          } else {
            // 单文件上传
            formData.append('file', item.file)

            const response = await api.post('/skills', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 60000
            })
            results.push({ title: item.title, success: true })
            successCount++
          }
        } catch (error) {
          results.push({ title: item.title, success: false, error: error.response?.data?.message || '上传失败' })
          failCount++
        }
      }

      setBatchResult({
        success: failCount === 0,
        message: `批量上传完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        results,
        successCount,
        failCount
      })

      if (failCount === 0) {
        setBatchFiles([])
        setBatchDescription('')
      }

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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 ${result.success ? (result.status === 'pending' ? 'border-t-4 border-yellow-500' : 'border-t-4 border-green-500') : 'border-t-4 border-red-500'}`}>
              <div className="text-center">
                {result.success ? (
                  <>
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
                        {result.isFolder && (
                          <p className="text-green-600 text-sm mb-4">✓ 包含 {result.fileCount} 个文件（已打包为 ZIP）</p>
                        )}
                        {result.hasFile && !result.isFolder && (
                          <p className="text-green-600 text-sm mb-4">✓ 包含附件文件</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-yellow-600 mb-2">申请已提交</h3>
                        <p className="text-gray-600 mb-2">上传申请已提交，等待管理员审核</p>
                        <p className="text-yellow-600 text-sm mb-4">
                          技能 "<strong>{result.skillTitle}</strong>" 审核通过后将在首页显示
                        </p>
                        <p className="text-gray-500 text-xs mb-4">可在「个人信息」页面查看审核状态</p>
                      </>
                    )}
                    <div className="flex gap-3 justify-center mt-6">
                      {result.isAdmin && (
                        <button onClick={goToSkill} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
                          查看详情
                        </button>
                      )}
                      <button onClick={goToHome} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition">
                        返回首页
                      </button>
                      <button onClick={uploadAnother} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition">
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
                      <button onClick={() => setResult(null)} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
                        重新上传
                      </button>
                      <button onClick={goToHome} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition">
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

            {/* 项目目录选择 */}
            {form.category === '项目' && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="block text-gray-700 mb-2 font-medium">项目目录 *</label>
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
                    <button type="button" onClick={() => setShowNewProject(true)} className="bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition">
                      + 新建项目
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="输入新项目名称" className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="text" value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="项目描述（可选）" className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <div className="flex gap-3">
                      <button type="button" onClick={handleCreateProject} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">创建项目</button>
                      <button type="button" onClick={() => { setShowNewProject(false); setNewProjectName(''); setNewProjectDesc('') }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition">取消</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 mb-2 font-medium">描述</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="请描述这个技能的作用和使用方法..." className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-medium">附件文件（可选）</label>
              <p className="text-sm text-gray-500 mb-3">
                支持选择单个文件或文件夹。文件夹会打包为 ZIP 上传。最大 50MB。
              </p>

              <div className="flex gap-3 mb-3">
                {/* 选择文件按钮 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-500 transition text-center flex-1">
                  <input type="file" onChange={handleFileChange} className="hidden" id="file-input" accept=".zip,.rar,.tar,.gz,.pdf,.doc,.docx,.md,.txt,.json,.js,.ts,.py,.java,.cpp,.c,.h,.sql,.xml,.yaml,.yml,.sh,.bat,.png,.jpg,.jpeg,.gif,.svg,.html,.css,.vue,.jsx,.tsx,.go,.rs,.rb,.php,.swift,.kt" />
                  <label htmlFor="file-input" className="cursor-pointer">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 text-sm">选择文件</p>
                  </label>
                </div>

                {/* 选择文件夹按钮 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-500 transition text-center flex-1">
                  <input type="file" onChange={handleFolderChange} className="hidden" id="folder-input" webkitdirectory="" directory="" />
                  <label htmlFor="folder-input" className="cursor-pointer">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-gray-600 text-sm">选择文件夹</p>
                  </label>
                </div>
              </div>

              {/* 已选择的文件 */}
              {file && (
                <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-green-700">{file.name}</span>
                  <span className="text-gray-500 text-sm">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button type="button" onClick={() => setFile(null)} className="ml-auto text-red-500 hover:text-red-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 已选择的文件夹 */}
              {folderFiles.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="font-medium text-blue-700">文件夹: {folderName}</span>
                    <span className="text-gray-500 text-sm">({folderFiles.length} 个文件)</span>
                    <button type="button" onClick={() => { setFolderFiles([]); setFolderName('') }} className="ml-auto text-red-500 hover:text-red-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-blue-600 text-xs">文件夹将打包为 ZIP 文件上传</p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.121 5.826 3 7.938l3-2.647z"></path>
                  </svg>
                  上传中...
                </>
              ) : '上传技能'}
            </button>
          </form>
        )}

        {/* 批量上传表单 */}
        {uploadMode === 'batch' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleBatchSubmit}>
              {/* 文件选择 */}
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">选择文件或文件夹 *</label>
                <p className="text-sm text-gray-500 mb-3">
                  可以选择多个文件或文件夹。每个文件/文件夹会创建一个技能。文件夹会打包为 ZIP。
                </p>

                <div className="flex gap-3 mb-4">
                  {/* 选择文件按钮 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-500 transition text-center flex-1">
                    <input type="file" onChange={handleBatchFilesChange} className="hidden" id="batch-file-input" multiple accept=".zip,.rar,.tar,.gz,.pdf,.doc,.docx,.md,.txt,.json,.js,.ts,.py,.java,.cpp,.c,.h,.sql,.xml,.yaml,.yml,.sh,.bat,.png,.jpg,.jpeg,.gif,.svg,.html,.css,.vue,.jsx,.tsx,.go,.rs,.rb,.php,.swift,.kt" />
                    <label htmlFor="batch-file-input" className="cursor-pointer">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-600 text-sm">选择多个文件</p>
                    </label>
                  </div>

                  {/* 选择文件夹按钮 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-500 transition text-center flex-1">
                    <input type="file" onChange={handleBatchFolderChange} className="hidden" id="batch-folder-input" webkitdirectory="" directory="" />
                    <label htmlFor="batch-folder-input" className="cursor-pointer">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-gray-600 text-sm">选择文件夹</p>
                    </label>
                  </div>
                </div>
              </div>

              {/* 已选择的文件列表 */}
              {batchFiles.length > 0 && (
                <div className="mb-6">
                  <label className="block text-gray-700 mb-2 font-medium">
                    已选择 {batchFiles.length} 个项目（可编辑标题）
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batchFiles.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {item.isFolder ? (
                          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <input type="text" value={item.title} onChange={(e) => updateBatchFileTitle(item.id, e.target.value)} className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="技能标题" />
                        <span className="text-sm text-gray-500">
                          {item.isFolder ? `(${item.file.length} 个文件)` : `(${(item.file.size / 1024 / 1024).toFixed(2)} MB)`}
                        </span>
                        <button type="button" onClick={() => removeBatchFile(item.id)} className="text-red-500 hover:text-red-700">
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
                <select value={batchCategory} onChange={(e) => { setBatchCategory(e.target.value); if (e.target.value === '个人') setBatchProjectId('') }} className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              {/* 项目目录选择 */}
              {batchCategory === '项目' && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-gray-700 mb-2 font-medium">项目目录 *</label>
                  <select value={batchProjectId} onChange={(e) => setBatchProjectId(e.target.value)} className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">-- 选择项目目录 --</option>
                    {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
              )}

              {/* 统一描述 */}
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">统一描述（应用到所有技能）</label>
                <textarea value={batchDescription} onChange={(e) => setBatchDescription(e.target.value)} rows={3} placeholder="可选，为所有上传的技能添加统一描述..." className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <button type="submit" disabled={batchLoading || batchFiles.length === 0} className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {batchLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.121 5.826 3 7.938l3-2.647z"></path>
                    </svg>
                    批量上传中...
                  </>
                ) : `批量上传 ${batchFiles.length} 个技能`}
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
                        <p className="text-gray-600">成功: {batchResult.successCount} 个，失败: {batchResult.failCount} 个</p>
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
                              {r.success ? '✓' : '✗'} {r.title} {r.isFolder ? `(文件夹，${r.fileCount} 个文件)` : ''}
                            </span>
                            {!r.success && <span className="text-red-500 text-sm ml-2">({r.error})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setBatchResult(null)} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">继续上传</button>
                    <button onClick={goToHome} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition">返回首页</button>
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