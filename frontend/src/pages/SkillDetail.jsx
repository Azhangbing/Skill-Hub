import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

// 获取状态标签
const getStatusBadge = (status) => {
  switch (status) {
    case 'approved':
      return <span className="bg-green-100 text-green-700 px-3 py-1 rounded font-medium">已通过</span>
    case 'pending':
      return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded font-medium">审核中</span>
    case 'rejected':
      return <span className="bg-red-100 text-red-700 px-3 py-1 rounded font-medium">已拒绝</span>
    default:
      return null
  }
}

// 可以预览的文件类型
const previewableExtensions = ['md', 'txt', 'json', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bat', 'html', 'css', 'vue', 'jsx', 'tsx', 'go', 'rs', 'rb', 'php', 'swift', 'kt']

// 获取文件扩展名
const getFileExtension = (filePath) => {
  if (!filePath) return ''
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1]
  const match = fileName.match(/^\d+-\d+-(.+)$/)
  const actualFileName = match ? match[1] : fileName
  return actualFileName.split('.').pop().toLowerCase()
}

// 判断文件是否可预览
const isPreviewable = (filePath) => {
  const ext = getFileExtension(filePath)
  return previewableExtensions.includes(ext)
}

export default function SkillDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [skill, setSkill] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [fileContent, setFileContent] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [installMethod, setInstallMethod] = useState('command')
  const [copied, setCopied] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null) // 正在回复的评论ID
  const [replyContent, setReplyContent] = useState('') // 回复内容
  const [installTargetDir, setInstallTargetDir] = useState('') // 安装目标目录
  const [installLink, setInstallLink] = useState('') // 生成的安装链接
  const [installLinkLoading, setInstallLinkLoading] = useState(false) // 链接生成加载
  const [installLinkCopied, setInstallLinkCopied] = useState(false) // 链接复制状态

  useEffect(() => {
    fetchSkill()
  }, [id])

  const fetchSkill = async () => {
    try {
      const res = await api.get(`/skills/${id}`)
      setSkill(res.data.skill)
      setComments(res.data.comments)
      // 如果技能未通过审核，重置到概述选项卡
      if (res.data.skill.status !== 'approved' && activeTab === 'install') {
        setActiveTab('overview')
      }
    } catch (error) {
      console.error('Fetch skill error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 复制安装命令
  const handleCopyCommand = () => {
    if (!skill?.install_command) return
    navigator.clipboard.writeText(skill.install_command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 生成带目录参数的安装链接
  const handleGenerateInstallLink = async () => {
    setInstallLinkLoading(true)
    try {
      const serverUrl = 'http://172.16.91.149:8080'
      const skillId = skill.slug || skill.id
      const targetDir = installTargetDir.trim()

      if (targetDir) {
        setInstallLink(`curl -s "${serverUrl}/api/skills/${skillId}/install-link?dir=${encodeURIComponent(targetDir)}" | python`)
      } else {
        setInstallLink(`curl -s "${serverUrl}/api/skills/${skillId}/install" | python`)
      }
    } catch (error) {
      console.error('Generate link error:', error)
      alert('生成链接失败')
    } finally {
      setInstallLinkLoading(false)
    }
  }

  // 复制安装链接
  const handleCopyInstallLink = () => {
    if (!installLink) return
    navigator.clipboard.writeText(installLink)
    setInstallLinkCopied(true)
    setTimeout(() => setInstallLinkCopied(false), 2000)
  }

  // 预览文件内容
  const handlePreviewFile = async () => {
    if (!skill.file_path) return

    setPreviewLoading(true)
    setShowPreview(true)

    try {
      const response = await api.get(`/skills/${id}/file`, {
        responseType: 'text'
      })
      setFileContent(response.data)
    } catch (error) {
      console.error('Preview file error:', error)
      setFileContent('无法加载文件内容')
    } finally {
      setPreviewLoading(false)
    }
  }

  // 下载文件附件
  const handleDownloadFile = async () => {
    try {
      const response = await api.get(`/skills/${id}/file`, {
        responseType: 'blob'
      })

      const filePath = skill.file_path
      let filename = skill.title

      if (filePath) {
        const parts = filePath.split('/')
        const fullFileName = parts[parts.length - 1]
        const match = fullFileName.match(/^\d+-\d+-(.+)$/)
        if (match) {
          filename = match[1]
        } else {
          filename = fullFileName
        }
      }

      const ext = filename.split('.').pop().toLowerCase()
      const mimeTypes = {
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
        'json': 'application/json',
        'md': 'text/markdown'
      }
      const mimeType = mimeTypes[ext] || 'application/octet-stream'

      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      fetchSkill()
    } catch (error) {
      console.error('Download file error:', error)
      alert('文件下载失败，请稍后重试')
    }
  }

  // 下载代码内容
  const handleDownloadContent = async () => {
    if (!skill.content) {
      alert('没有代码内容可下载')
      return
    }
    try {
      const blob = new Blob([skill.content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${skill.title}.txt`
      a.click()
      window.URL.revokeObjectURL(url)

      await api.post(`/skills/${id}/download`)
      fetchSkill()
    } catch (error) {
      console.error('Download content error:', error)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      await api.post(`/skills/${id}/comments`, { content: newComment })
      setNewComment('')
      fetchSkill()
    } catch (error) {
      console.error('Add comment error:', error)
      alert('评论发表失败')
    }
  }

  // 回复评论
  const handleReplyComment = async (e, parentId) => {
    e.preventDefault()
    if (!replyContent.trim()) return

    try {
      await api.post(`/skills/${id}/comments`, {
        content: replyContent,
        parent_id: parentId
      })
      setReplyContent('')
      setReplyingTo(null)
      fetchSkill()
    } catch (error) {
      console.error('Reply comment error:', error)
      alert('回复发表失败')
    }
  }

  // 开始回复
  const startReply = (commentId) => {
    setReplyingTo(commentId)
    setReplyContent('')
  }

  // 取消回复
  const cancelReply = () => {
    setReplyingTo(null)
    setReplyContent('')
  }

  // 组织评论树结构
  const organizeComments = (comments) => {
    const rootComments = comments.filter(c => !c.parent_id)
    const replyMap = {}
    comments.forEach(c => {
      if (c.parent_id) {
        if (!replyMap[c.parent_id]) {
          replyMap[c.parent_id] = []
        }
        replyMap[c.parent_id].push(c)
      }
    })
    return { rootComments, replyMap }
  }

  const { rootComments, replyMap } = organizeComments(comments)

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个技能吗？')) return

    try {
      await api.delete(`/skills/${id}`)
      navigate('/')
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!skill) {
    return <div className="text-center py-12">技能不存在</div>
  }

  const isOwner = user && user.id === skill.author_id

  // 从file_path提取文件名
  const getFileName = (filePath) => {
    if (!filePath) return ''
    const parts = filePath.split('/')
    return parts[parts.length - 1]
  }

  // 格式化日期
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // 只有approved状态才显示安装选项卡
  const tabs = [
    { id: 'overview', label: '概述', icon: '📋' },
    ...(skill.status === 'approved' ? [{ id: 'install', label: '安装', icon: '📦' }] : []),
    { id: 'comments', label: '评论', icon: '💬', count: comments.length }
  ]

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-t-xl transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </Link>
      </div>

      {/* 头部信息 */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-primary-100 text-primary-600 px-3 py-1 rounded">
            {skill.category}
          </span>
          {skill.project_name && (
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded">
              {skill.project_name}
            </span>
          )}
          {skill.status && getStatusBadge(skill.status)}
          {skill.file_path && (
            <span className="bg-green-100 text-green-600 px-3 py-1 rounded">
              含附件文件
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-4">{skill.title}</h1>

        <div className="flex items-center gap-4 text-gray-500 mb-4">
          <Link to={`/profile/${skill.author_id}`} className="hover:text-primary-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {skill.author_name}
          </Link>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {skill.downloads || 0} 次下载
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(skill.created_at)}
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          {isOwner && (
            <>
              <Link
                to={`/edit/${skill.id}`}
                className="bg-gray-200 px-6 py-2 rounded hover:bg-gray-300 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑
              </Link>
              <button
                onClick={handleDelete}
                className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* 选项卡导航 */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b">
          <nav className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-8">
          {/* 概述选项卡 */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-primary-500">📝</span>
                  描述
                </h3>
                <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                  {skill.description || '暂无描述'}
                </div>
              </div>

              {skill.content && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="text-primary-500">💻</span>
                    代码内容
                  </h3>
                  <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96 bg-gray-900 text-gray-100 p-4 rounded-lg font-mono">
                    {skill.content}
                  </pre>
                </div>
              )}

              {/* 附件文件信息 - 只有approved状态才能预览 */}
              {skill.file_path && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-bold mb-2 text-blue-800 flex items-center gap-2">
                    <span>📦</span>
                    附件文件
                  </h3>
                  {skill.status !== 'approved' ? (
                    <div className="flex items-center gap-2 text-red-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm">该技能未通过审核，无法预览附件</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-blue-700">{getFileName(skill.file_path)}</span>
                          {isPreviewable(skill.file_path) && (
                            <span className="text-xs text-blue-500">（可预览）</span>
                          )}
                        </div>
                        {isPreviewable(skill.file_path) && (
                          <button
                            onClick={handlePreviewFile}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            预览
                          </button>
                        )}
                      </div>

                      {/* 文件预览区域 */}
                      {showPreview && (
                        <div className="mt-4 border-t border-blue-200 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-blue-800 font-medium">文件内容预览</h4>
                            <button
                              onClick={() => setShowPreview(false)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {previewLoading ? (
                            <div className="text-center py-4 text-blue-600">加载中...</div>
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96 bg-blue-100 p-3 rounded text-gray-800">
                              {fileContent}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 安装选项卡 */}
          {activeTab === 'install' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">选择安装方式</h3>

                {/* 安装方式切换 */}
                <div className="flex border rounded-lg overflow-hidden mb-6">
                  <button
                    onClick={() => setInstallMethod('command')}
                    className={`flex-1 px-6 py-3 flex items-center justify-center gap-2 font-medium transition ${
                      installMethod === 'command'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    命令行安装
                  </button>
                  <button
                    onClick={() => setInstallMethod('package')}
                    className={`flex-1 px-6 py-3 flex items-center justify-center gap-2 font-medium transition ${
                      installMethod === 'package'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    压缩包安装
                  </button>
                </div>

                {/* 命令行安装 */}
                {installMethod === 'command' && (
                  <div className="space-y-4">
                    <div className="bg-gray-900 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm">技能名称：{skill.title}</span>
                        <span className="text-gray-400 text-sm">设置下载目录生成安装命令</span>
                      </div>

                      {/* 目录输入 */}
                      <input
                        type="text"
                        value={installTargetDir}
                        onChange={(e) => setInstallTargetDir(e.target.value)}
                        placeholder="输入目标目录，如: /home/user/project 或 D:\\work"
                        className="w-full bg-gray-800 text-white px-4 py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                      />

                      {/* 生成按钮 */}
                      <button
                        onClick={handleGenerateInstallLink}
                        disabled={installLinkLoading}
                        className="w-full bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {installLinkLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            生成中...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            生成安装命令
                          </>
                        )}
                      </button>

                      {/* 生成的链接显示 */}
                      {installLink && (
                        <div className="mt-4 bg-gray-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">
                              {installTargetDir ? `下载到: ${installTargetDir}` : '下载到当前目录'}
                            </span>
                            <button
                              onClick={() => { setInstallLink(''); setInstallTargetDir(''); }}
                              className="text-gray-500 hover:text-gray-300"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-gray-700 text-green-400 px-4 py-3 rounded font-mono text-sm overflow-x-auto">
                              {installLink}
                            </code>
                            <button
                              onClick={handleCopyInstallLink}
                              className={`px-4 py-3 rounded font-medium transition flex items-center gap-2 ${
                                installLinkCopied ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                              }`}
                            >
                              {installLinkCopied ? (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  已复制
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  复制
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 mb-2">安装说明</h4>
                      <ul className="text-blue-700 text-sm space-y-1">
                        <li>1. 输入目标目录路径（可选），不输入则下载到当前目录</li>
                        <li>2. 点击"生成安装命令"</li>
                        <li>3. 复制生成的命令在终端运行</li>
                      </ul>
                      <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-600">
                        <p className="font-medium mb-1">提示：</p>
                        <p>生成的命令可在任意终端运行，ZIP 文件会自动解压</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 压缩包安装 */}
                {installMethod === 'package' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <h4 className="font-medium text-gray-700 mb-2">下载压缩包安装</h4>
                        <p className="text-gray-500 text-sm mb-4">下载技能包压缩文件，解压后放入项目目录</p>
                        <button
                          onClick={handleDownloadFile}
                          disabled={!skill.file_path}
                          className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition ${
                            skill.file_path
                              ? 'bg-primary-500 text-white hover:bg-primary-600'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {skill.file_path ? '下载压缩包' : '暂无压缩包'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        手动安装步骤
                      </h4>
                      <ol className="list-decimal list-inside text-yellow-700 space-y-1 text-sm">
                        <li>点击上方按钮下载压缩包</li>
                        <li>解压下载的文件</li>
                        <li>将解压后的目录放入项目的 <code className="bg-yellow-100 px-1 rounded">.skill-hub/skills/</code> 目录</li>
                        <li>根据 README 文件进行配置</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 评论选项卡 */}
          {activeTab === 'comments' && (
            <div className="space-y-6">
              {user ? (
                <form onSubmit={handleAddComment} className="bg-gray-50 rounded-lg p-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="写下你的评论..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    rows={4}
                  />
                  <button
                    type="submit"
                    className="mt-3 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    发表评论
                  </button>
                </form>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <p className="text-gray-500">
                    <Link to="/login" className="text-primary-600 hover:underline font-medium">登录</Link> 后发表评论
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-gray-500">暂无评论</p>
                  </div>
                ) : (
                  rootComments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                      {/* 主评论 */}
                      <div className="mb-2">
                        <span className="font-medium text-gray-800">{comment.user_name}</span>
                        <span className="text-gray-400 text-xs ml-3">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-gray-700 mb-3">{comment.content}</p>

                      {/* 回复按钮 */}
                      {user && (
                        <button
                          onClick={() => startReply(comment.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          回复
                        </button>
                      )}

                      {/* 回复输入框 */}
                      {replyingTo === comment.id && (
                        <form onSubmit={(e) => handleReplyComment(e, comment.id)} className="mt-3 ml-4">
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={`回复 ${comment.user_name}...`}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              type="submit"
                              className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary-700 transition"
                            >
                              发送回复
                            </button>
                            <button
                              type="button"
                              onClick={cancelReply}
                              className="bg-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-300 transition"
                            >
                              取消
                            </button>
                          </div>
                        </form>
                      )}

                      {/* 回复列表 */}
                      {replyMap[comment.id] && replyMap[comment.id].length > 0 && (
                        <div className="mt-4 ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                          {replyMap[comment.id].map(reply => (
                            <div key={reply.id} className="bg-white rounded-lg p-3">
                              <div className="mb-2">
                                <span className="font-medium text-gray-800 text-sm">{reply.user_name}</span>
                                <span className="text-gray-400 text-xs ml-2">{formatDate(reply.created_at)}</span>
                              </div>
                              <p className="text-gray-700 text-sm">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
