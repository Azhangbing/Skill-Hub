import axios from 'axios'

const api = axios.create({
  baseURL: 'http://172.16.91.149:8080/api',
  timeout: 60000  // 增加到60秒，大文件上传需要更多时间
})

// 自动添加token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api