import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Webhooks from './pages/Webhooks';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import Users from './pages/Users';
import SendGridLists from './pages/SendGridLists';
import SendGridTemplates from './pages/SendGridTemplates';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { Toaster } from './components/ui/sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Setup axios defaults
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
          <Route
            path="/*"
            element={
              user ? (
                <Layout user={user} logout={logout}>
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route path="/webhooks" element={<Webhooks user={user} />} />
                    <Route path="/logs" element={<Logs user={user} />} />
                    <Route path="/sendgrid-lists" element={<SendGridLists user={user} />} />
                    <Route path="/sendgrid-templates" element={<SendGridTemplates user={user} />} />
                    <Route path="/settings" element={<Settings user={user} />} />
                    <Route path="/profile" element={<Profile user={user} />} />
                    {user.role === 'admin' && <Route path="/users" element={<Users user={user} />} />}
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;