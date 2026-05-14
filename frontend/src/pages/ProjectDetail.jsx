import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  // 批量下载状态
  const [batchMode, setBatchMode] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [downloadLink, setDownloadLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [showDirDialog, setShowDirDialog] = useState(false)
  const [selectedDir, setSelectedDir] = useState('')
  const [dirInputValue, setDirInputValue] = useState('')

  useEffect(() => {
    fetchProject()
    fetchSkills()
  }, [id])

  const fetchProject = async () => {
    try {
      const res = await api.get('/projects')
      const found = res.data.find(p => p.id === parseInt(id))
      setProject(found)
    } catch (error) {
      console.error('Fetch project error:', error)
    }
  }

  const fetchSkills = async () => {
    try {
      const res = await api.get(`/projects/${id}/skills`)
      setSkills(res.data.skills)
    } catch (error) {
      console.error('Fetch skills error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 批量选择功能
  const toggleSkillSelection = (skillId) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  const selectAllSkills = () => {
    const allIds = skills.filter(s => s.file_path).map(s => s.id)
    setSelectedSkills(allIds)
  }

  const deselectAllSkills = () => {
    setSelectedSkills([])
  }

  const isAllSelected = () => {
    const skillsWithFiles = skills.filter(s => s.file_path)
    return skillsWithFiles.length > 0 && selectedSkills.length === skillsWithFiles.length
  }

  // 生成下载脚本
  const generateBatchScript = async () => {
    if (selectedSkills.length === 0) {
      alert('请选择至少一个技能')
      return
    }

    try {
      const res = await api.post('/skills/batch-install', {
        skillIds: selectedSkills
      })

      // 后端直接返回纯文本脚本
      const scriptContent = res.data
      const blob = new Blob([scriptContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch_install_project_${id}.py`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Generate script error:', error)
      alert(error.response?.data?.message || '生成下载脚本失败')
    }
  }

  // 生成下载链接
  const generateDownloadLink = () => {
    if (selectedSkills.length === 0) {
      alert('请选择至少一个技能')
      return
    }
    // 打开目录选择对话框
    setShowDirDialog(true)
    setDirInputValue('')
  }

  // 处理目录选择
  const handleDirSelect = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const relativePath = file.webkitRelativePath
      const dirName = relativePath.split('/')[0]
      setDirInputValue(dirName)
    }
  }

  // 确认目录并生成链接
  const confirmDirAndGenerateLink = async () => {
    setShowDirDialog(false)
    setBatchLoading(true)
    try {
      const targetDir = dirInputValue || selectedDir

      const response = await api.post('/skills/batch-install', {
        skillIds: selectedSkills,
        type: 'link',
        targetDir: targetDir
      })

      setDownloadLink(response.data.link)
      setSelectedDir(targetDir)
      setLinkCopied(false)
    } catch (error) {
      console.error('Generate link error:', error)
      alert(error.response?.data?.message || '生成链接失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 不指定目录，使用默认路径
  const generateLinkWithDefaultDir = async () => {
    setShowDirDialog(false)
    setBatchLoading(true)
    try {
      const response = await api.post('/skills/batch-install', {
        skillIds: selectedSkills,
        type: 'link',
        targetDir: ''
      })

      setDownloadLink(response.data.link)
      setSelectedDir('')
      setLinkCopied(false)
    } catch (error) {
      console.error('Generate link error:', error)
      alert(error.response?.data?.message || '生成链接失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 复制下载链接
  const copyDownloadLink = () => {
    navigator.clipboard.writeText(downloadLink)
    setLinkCopied(true)
  }

  // 关闭下载链接弹窗
  const closeDownloadLink = () => {
    setDownloadLink('')
    setLinkCopied(false)
    setSelectedDir('')
    setDirInputValue('')
  }

  // 从file_path提取文件名
  const getFileName = (filePath) => {
    if (!filePath) return ''
    const parts = filePath.split('/')
    return parts[parts.length - 1]
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <Link to="/projects" className="inline-flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-xl transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回项目列表
          </Link>
        </div>
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">项目不存在</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="bg-white rounded-xl shadow-sm">
        <Link to="/projects" className="inline-flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-xl transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回项目列表
        </Link>
      </div>

      {/* 项目信息 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            <p className="text-gray-500 mt-1">{project.description || '暂无描述'}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          创建者：{project.created_by_name} · {skills.length} 个技能 · {new Date(project.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* 技能列表 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">项目下的技能</h2>
          {skills.filter(s => s.file_path).length > 0 && (
            <button
              onClick={() => {
                setBatchMode(!batchMode)
                if (batchMode) {
                  setSelectedSkills([])
                  setDownloadLink('')
                }
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                batchMode ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
              }`}
            >
              {batchMode ? '取消选择' : '批量下载'}
            </button>
          )}
        </div>

        {/* 批量操作工具栏 */}
        {batchMode && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={selectAllSkills}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                全选
              </button>
              <button
                onClick={deselectAllSkills}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                取消全选
              </button>
              <span className="text-sm text-gray-600">
                已选择 {selectedSkills.length} 个技能
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateBatchScript}
                disabled={selectedSkills.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成下载脚本
              </button>
              <button
                onClick={generateDownloadLink}
                disabled={selectedSkills.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成下载链接
              </button>
            </div>
          </div>
        )}

        {/* 下载链接弹窗 */}
        {downloadLink && (
          <div className="px-6 py-4 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-800 font-medium">下载链接（复制到终端运行）：</span>
              <button
                onClick={closeDownloadLink}
                className="text-green-600 hover:text-green-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {selectedDir && (
              <p className="text-green-700 text-sm mb-2">
                目标目录: <span className="font-medium">{selectedDir}</span>
              </p>
            )}
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-4 py-2 rounded font-mono text-sm text-gray-800 overflow-x-auto">
                {downloadLink}
              </code>
              <button
                onClick={copyDownloadLink}
                className={`px-4 py-2 rounded font-medium transition ${
                  linkCopied ? 'bg-green-500 text-white' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {linkCopied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-green-600 text-sm mt-2">
              {selectedDir
                ? `将此链接复制到任意终端运行，技能将下载到 ${selectedDir} 目录`
                : '将此链接复制到任意终端运行，技能将下载到当前目录的 .skill 文件夹'}
            </p>
          </div>
        )}

        {skills.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">该项目暂无技能</p>
            <Link to={`/upload?project_id=${id}&category=项目`} className="inline-block mt-3 text-primary-600 hover:text-primary-700 font-medium">
              上传技能到此项目 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {skills.map(skill => (
              batchMode ? (
                <div
                  key={skill.id}
                  className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition cursor-pointer ${
                    selectedSkills.includes(skill.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => skill.file_path && toggleSkillSelection(skill.id)}
                >
                  {/* 复选框 */}
                  <div className="w-5 h-5 flex items-center justify-center">
                    {skill.file_path ? (
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedSkills.includes(skill.id)
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedSkills.includes(skill.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">无文件</span>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {skill.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800">{skill.title}</h3>
                    <p className="text-sm text-gray-500 truncate">{skill.description || '暂无描述'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-500">{skill.author_name}</p>
                    <p className="text-xs text-gray-400">{skill.downloads || 0} 次下载</p>
                  </div>
                  {skill.file_path && (
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium shrink-0">
                      有附件
                    </span>
                  )}
                </div>
              ) : (
                <Link
                  key={skill.id}
                  to={`/skill/${skill.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {skill.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800">{skill.title}</h3>
                    <p className="text-sm text-gray-500 truncate">{skill.description || '暂无描述'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-500">{skill.author_name}</p>
                    <p className="text-xs text-gray-400">{skill.downloads || 0} 次下载</p>
                  </div>
                  {skill.file_path && (
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium shrink-0">
                      有附件
                    </span>
                  )}
                </Link>
              )
            ))}
          </div>
        )}
      </div>

      {/* 目录选择弹窗 */}
      {showDirDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">设置下载目录</h3>
              <button
                onClick={() => setShowDirDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                输入技能下载的目标目录完整路径。生成的链接可在任意终端运行，技能将下载到指定目录。
              </p>

              {/* 手动输入完整路径 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目标目录完整路径 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dirInputValue}
                  onChange={(e) => setDirInputValue(e.target.value)}
                  placeholder="例如: /home/user/projects/test 或 D:\\projects\\test"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">
                  <strong>重要：</strong>请输入完整的绝对路径，确保目录存在或脚本会自动创建。
                </p>
              </div>

              {/* 快捷选择按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setDirInputValue('./.skill')}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition"
                >
                  当前目录/.skill
                </button>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowDirDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                  取消
                </button>
                <button
                  onClick={generateLinkWithDefaultDir}
                  disabled={batchLoading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                >
                  使用默认目录
                </button>
                <button
                  onClick={confirmDirAndGenerateLink}
                  disabled={batchLoading || !dirInputValue.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batchLoading ? '生成中...' : '确认并生成链接'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}