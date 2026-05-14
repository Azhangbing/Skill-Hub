import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import SkillDetail from './pages/SkillDetail'
import Upload from './pages/Upload'
import Profile from './pages/Profile'
import EditSkill from './pages/EditSkill'
import Admin from './pages/Admin'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'

function AppLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 pt-22 mt-16">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  if (!user) {
    // 未登录：只能访问登录/注册页
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // 已登录：可以访问所有页面，刷新时保持当前界面
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/" element={<AppLayout><Home /></AppLayout>} />
      <Route path="/skill/:id" element={<AppLayout><SkillDetail /></AppLayout>} />
      <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
      <Route path="/project/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
      <Route path="/upload" element={<AppLayout><Upload /></AppLayout>} />
      <Route path="/profile/:id?" element={<AppLayout><Profile /></AppLayout>} />
      <Route path="/edit/:id" element={<AppLayout><EditSkill /></AppLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App