import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Home() {
  const [personalSkills, setPersonalSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [downloadLink, setDownloadLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const skillsRes = await api.get('/skills', {
        params: { category: '个人', limit: 50 }
      })
      setPersonalSkills(skillsRes.data.skills)
    } catch (error) {
      console.error('Fetch data error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 实时搜索过滤 - 根据搜索框内容过滤技能列表
  const filteredSkills = search.trim()
    ? personalSkills.filter(skill =>
        skill.title.toLowerCase().includes(search.toLowerCase()) ||
        (skill.description && skill.description.toLowerCase().includes(search.toLowerCase()))
      )
    : personalSkills

  // 搜索框内容变化时的处理
  const handleSearchChange = (e) => {
    setSearch(e.target.value)
  }

  // 批量选择功能
  const toggleBatchMode = () => {
    setBatchMode(!batchMode)
    setSelectedSkills([])
    setDownloadLink('')
  }

  const toggleSkillSelection = (skillId) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  const selectAllSkills = () => {
    const allIds = filteredSkills
      .filter(s => s.file_path)
      .map(s => s.id)
    setSelectedSkills(allIds)
  }

  const deselectAllSkills = () => {
    setSelectedSkills([])
  }

  // 判断是否全选
  const isAllSelected = () => {
    const downloadableIds = filteredSkills.filter(s => s.file_path).map(s => s.id)
    return downloadableIds.length > 0 && downloadableIds.every(id => selectedSkills.includes(id))
  }

  const generateBatchScript = async () => {
    if (selectedSkills.length === 0) {
      alert('请先选择要下载的技能')
      return
    }

    setBatchLoading(true)
    try {
      const response = await api.post('/skills/batch-install', {
        skillIds: selectedSkills
      }, {
        responseType: 'text'
      })

      // 下载脚本文件
      const blob = new Blob([response.data], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'batch_install.py'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      alert(`已生成下载脚本，包含 ${selectedSkills.length} 个技能`)
      setBatchMode(false)
      setSelectedSkills([])
    } catch (error) {
      console.error('Batch install error:', error)
      alert(error.response?.data?.message || '生成脚本失败')
    } finally {
      setBatchLoading(false)
    }
  }

  const generateBatchLink = async () => {
    if (selectedSkills.length === 0) {
      alert('请先选择要下载的技能')
      return
    }

    setBatchLoading(true)
    try {
      const response = await api.post('/skills/batch-install', {
        skillIds: selectedSkills,
        type: 'link',
        targetDir: ''
      })

      setDownloadLink(response.data.link)
    } catch (error) {
      console.error('Generate link error:', error)
      alert(error.response?.data?.message || '生成链接失败')
    } finally {
      setBatchLoading(false)
    }
  }

  const copyDownloadLink = () => {
    if (downloadLink) {
      navigator.clipboard.writeText(downloadLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const closeDownloadLink = () => {
    setDownloadLink('')
    setLinkCopied(false)
    setBatchMode(false)
    setSelectedSkills([])
  }

  // 技能卡片组件 - 矩阵格式
  const SkillCard = ({ skill }) => {
    const isSelected = selectedSkills.includes(skill.id)
    const canDownload = skill.file_path

    if (batchMode) {
      return (
        <div
          onClick={() => canDownload && toggleSkillSelection(skill.id)}
          className={`group bg-blue-50 rounded-xl shadow-sm border-2 p-4 transition-all duration-200 flex flex-col h-full cursor-pointer ${
            isSelected
              ? 'border-primary-500 bg-primary-50'
              : canDownload
                ? 'border-blue-100 hover:border-primary-300'
                : 'border-gray-200 opacity-50 cursor-not-allowed'
          }`}
        >
          {/* 选择指示器 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                isSelected
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-gray-300'
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                skill.category === '个人'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {skill.category}
              </span>
            </div>
            {skill.file_path ? (
              <span className="bg-white text-gray-600 px-2 py-1 rounded text-xs">可下载</span>
            ) : (
              <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded text-xs">无附件</span>
            )}
          </div>

          <h4 className="font-semibold text-gray-800 mb-2 line-clamp-1">{skill.title}</h4>
          <p className="text-gray-500 text-sm line-clamp-2 flex-grow">{skill.description || '暂无描述'}</p>

          <div className="flex items-center justify-between pt-3 border-t border-blue-100 mt-3">
            <span className="text-xs text-gray-500">{skill.author_name}</span>
            <span className="text-xs text-gray-400">{skill.downloads || 0} 次下载</span>
          </div>
        </div>
      )
    }

    return (
      <Link
        to={`/skill/${skill.id}`}
        className="group bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-4 hover:shadow-md hover:border-primary-200 transition-all duration-200 flex flex-col h-full"
      >
        {/* 头部：分类和附件标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            skill.category === '个人'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {skill.category}
          </span>
          {skill.file_path && (
            <span className="bg-white text-gray-600 px-2 py-1 rounded text-xs">
              附件
            </span>
          )}
        </div>

        {/* 标题 */}
        <h4 className="font-semibold text-gray-800 group-hover:text-primary-600 mb-2 line-clamp-1">
          {skill.title}
        </h4>

        {/* 描述 */}
        <p className="text-gray-500 text-sm line-clamp-2 mb-3 flex-grow">
          {skill.description || '暂无描述'}
        </p>

        {/* 底部：作者和下载量 */}
        <div className="flex items-center justify-between pt-3 border-t border-blue-100">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {skill.author_name}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {skill.downloads || 0}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      {/* 欢迎区域 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              欢迎回来，{user?.username}
              {user?.role === 'super_admin' && (
                <span className="ml-2 bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-medium">
                  主管理员
                </span>
              )}
              {user?.role === 'admin' && (
                <span className="ml-2 bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-sm font-medium">
                  管理员
                </span>
              )}
            </h2>
            <p className="text-gray-500 mt-1">发现和分享团队技能知识</p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            上传技能
          </Link>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索技能..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Link to="/upload" className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          上传技能
        </Link>
        <button
          onClick={toggleBatchMode}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            batchMode
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {batchMode ? '取消选择' : '批量下载'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 mt-4">加载中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              个人技能
              <span className="text-sm font-normal text-gray-400">({filteredSkills.length})</span>
            </h3>
            <Link to="/upload" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              + 上传新技能
            </Link>
          </div>
          {filteredSkills.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">{search ? '没有找到匹配的技能' : '暂无个人技能'}</p>
              {!search && (
                <Link to="/upload" className="inline-block mt-3 text-primary-600 hover:text-primary-700 font-medium">
                  上传第一个技能 →
                </Link>
              )}
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredSkills.map(skill => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          )}

          {/* 批量操作工具栏 */}
          {batchMode && filteredSkills.length > 0 && (
            <div className="px-6 py-4 bg-orange-50 border-t border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-orange-700 font-medium">
                    已选择 {selectedSkills.length} 个技能
                  </span>
                  <button
                    onClick={isAllSelected() ? deselectAllSkills : selectAllSkills}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {isAllSelected() ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={deselectAllSkills}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    清空选择
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={generateBatchScript}
                    disabled={selectedSkills.length === 0 || batchLoading}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      selectedSkills.length > 0 && !batchLoading
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {batchLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载脚本
                      </>
                    )}
                  </button>
                  <button
                    onClick={generateBatchLink}
                    disabled={selectedSkills.length === 0 || batchLoading}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      selectedSkills.length > 0 && !batchLoading
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {batchLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        生成链接
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 下载链接显示区域 */}
              {downloadLink && (
                <div className="bg-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-800 font-medium">下载链接（复制到终端运行）：</span>
                    <button
                      onClick={closeDownloadLink}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-4 py-2 rounded font-mono text-sm text-gray-800 overflow-x-auto">
                      {downloadLink}
                    </code>
                    <button
                      onClick={copyDownloadLink}
                      className={`px-4 py-2 rounded font-medium transition ${
                        linkCopied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {linkCopied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="text-blue-600 text-sm mt-2">
                    将此链接复制到任意终端运行，技能将下载到指定目录
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}