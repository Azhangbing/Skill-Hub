import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = user ? [
    { path: '/', icon: 'home', label: '首页' },
    { path: '/projects', icon: 'folder', label: '项目目录' },
    { path: '/upload', icon: 'upload', label: '上传技能' },
    { path: `/profile/${user.employee_id}`, icon: 'user', label: '个人信息' },
    // 所有用户都能看到管理后台，但普通用户访问会提示无权限
    { path: '/admin', icon: 'settings', label: '管理后台' },
  ] : [
    { path: '/', icon: 'home', label: '首页' },
    { path: '/projects', icon: 'folder', label: '项目目录' },
  ]

  const icons = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    folder: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    upload: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    user: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    if (path?.includes('/profile')) return location.pathname.startsWith('/profile')
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="w-64 bg-gradient-to-b from-primary-600 to-primary-700 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl">
      {/* Logo 区域 */}
      <div className="p-5 border-b border-primary-500/30">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur group-hover:bg-white/20 transition">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
          </div>
          <div>
            <p className="font-bold text-lg tracking-wide">雅迅智联</p>
            <p className="text-xs text-primary-200">厦门雅迅智联科技</p>
          </div>
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive(item.path)
                  ? 'bg-white/15 text-white shadow-lg'
                  : 'text-primary-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`transition ${isActive(item.path) ? 'scale-110' : ''}`}>
                {icons[item.icon]}
              </span>
              <span className="font-medium">{item.label}</span>
              {isActive(item.path) && (
                <span className="ml-auto w-2 h-2 bg-white rounded-full"></span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* 底部 */}
      <div className="p-4 border-t border-primary-500/30">
        {user ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-primary-200 hover:bg-red-500/20 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">退出登录</span>
          </button>
        ) : (
          <div className="space-y-2">
            <Link
              to="/login"
              className="block px-4 py-2.5 rounded-xl text-center hover:bg-white/10 transition text-sm"
            >
              登录
            </Link>
            <Link
              to="/register"
              className="block px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-center transition text-sm font-medium"
            >
              注册
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}