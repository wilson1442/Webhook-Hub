import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { LayoutDashboard, Webhook, FileText, Settings, Users, LogOut, Menu, X, List, Mail, User, TestTube2, Database, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';

const Layout = ({ children, user, logout }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendgridOpen, setSendgridOpen] = useState(true);
  const [sendgridEnabled, setSendgridEnabled] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Webhooks', href: '/webhooks', icon: Webhook },
    { name: 'Test', href: '/test', icon: TestTube2 },
    { name: 'Logs', href: '/logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Release Notes', href: '/release-notes', icon: BookOpen },
  ];

  const sendgridSubmenu = [
    { name: 'SendGrid Contacts', href: '/sendgrid-contacts', icon: Users },
    { name: 'SendGrid Lists', href: '/sendgrid-lists', icon: List },
    { name: 'SendGrid Templates', href: '/sendgrid-templates', icon: Mail },
    { name: 'SendGrid Fields', href: '/sendgrid-fields', icon: Database },
  ];

  if (user.role === 'admin') {
    navigation.splice(5, 0, { name: 'Users', href: '/users', icon: Users });
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <Webhook className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Webhook Hub</h1>
                <p className="text-xs text-gray-600">{user.username}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)}>
                  <div
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-100'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}

            {/* SendGrid Submenu */}
            <div>
              <button
                onClick={() => setSendgridOpen(!sendgridOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5" />
                  <span className="font-medium">SendGrid Data</span>
                </div>
                {sendgridOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {sendgridOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {sendgridSubmenu.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)}>
                        <div
                          className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-100'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full justify-start mb-2"
              onClick={logout}
              data-testid="logout-btn"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </Button>
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
              v1.0.2
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b lg:hidden">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="mobile-menu-btn"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            <h1 className="text-lg font-bold">Webhook Hub</h1>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;