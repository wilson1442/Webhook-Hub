import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { User, Moon, Sun, Shield, Calendar, Lock, Eye, EyeOff } from 'lucide-react';

const Profile = ({ user }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    // Load dark mode preference from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    applyDarkMode(savedDarkMode);
  }, []);

  const applyDarkMode = (enabled) => {
    if (enabled) {
      document.documentElement.classList.add('dark');
      document.body.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0fdf4 100%)';
    }
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    applyDarkMode(newDarkMode);
    toast.success(newDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.old_password === passwordData.new_password) {
      toast.error('New password must be different from old password');
      return;
    }

    setChangingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      
      toast.success('Password changed successfully!');
      
      // Clear form
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      // Hide password fields
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="profile-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
      </div>

      {/* User Information */}
      <Card className="glass card-hover" data-testid="user-info-card">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">{user.username}</CardTitle>
              <CardDescription className="flex items-center mt-2">
                <Shield className="h-4 w-4 mr-2" />
                {user.role === 'admin' ? 'Administrator' : 'Standard User'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Username</Label>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{user.username}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Role</Label>
              <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                {user.role}
              </span>
            </div>
          </div>

          {user.last_login && (
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="inline h-4 w-4 mr-1" />
                Last Login
              </Label>
              <p className="text-gray-800 dark:text-gray-200">
                {new Date(user.last_login).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card className="glass card-hover" data-testid="appearance-card">
        <CardHeader>
          <CardTitle className="text-xl">Appearance</CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                {darkMode ? (
                  <Moon className="h-5 w-5 text-white" />
                ) : (
                  <Sun className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <Label className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  Dark Mode
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {darkMode ? 'Dark theme is enabled' : 'Light theme is enabled'}
                </p>
              </div>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              data-testid="dark-mode-toggle"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings - Change Password */}
      <Card className="glass card-hover" data-testid="security-card">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-500 rounded-full">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Security</CardTitle>
              <CardDescription>Change your password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Old Password */}
            <div className="space-y-2">
              <Label htmlFor="old-password" className="text-sm font-medium">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="old-password"
                  type={showOldPassword ? "text" : "password"}
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                  placeholder="Enter your current password"
                  className="pr-10"
                  data-testid="old-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  placeholder="Enter your new password"
                  className="pr-10"
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Password must be at least 6 characters
              </p>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  placeholder="Confirm your new password"
                  className="pr-10"
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={changingPassword}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              data-testid="change-password-btn"
            >
              {changingPassword ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
