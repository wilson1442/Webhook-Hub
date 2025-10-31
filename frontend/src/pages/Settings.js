import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Key, Trash2, Check, X, Download, GitBranch, Clock, Calendar } from 'lucide-react';

const Settings = ({ user }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [backups, setBackups] = useState([]);
  const [scheduledBackups, setScheduledBackups] = useState([]);
  const [backupSettings, setBackupSettings] = useState({
    frequency: 'daily',
    retention: 7
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [keyFormData, setKeyFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [githubInfo, setGithubInfo] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullSuccess, setPullSuccess] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [deploymentLogs, setDeploymentLogs] = useState([]);
  const [selectedLogContent, setSelectedLogContent] = useState('');
  const [showLogDialog, setShowLogDialog] = useState(false);

  useEffect(() => {
    if (user.role === 'admin') {
      fetchApiKeys();
      fetchBackups();
      fetchBackupSettings();
      fetchScheduledBackups();
      fetchGithubInfo();
      fetchDeploymentLogs();
    }
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      setApiKeys(response.data);
    } catch (error) {
      toast.error('Failed to fetch API keys');
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await axios.get(`${API}/backups`);
      setBackups(response.data);
    } catch (error) {
      // Backups may not exist yet
    }
  };

  const fetchBackupSettings = async () => {
    try {
      const response = await axios.get(`${API}/backups/settings`);
      setBackupSettings(response.data);
    } catch (error) {
      toast.error('Failed to fetch backup settings');
    }
  };

  const fetchScheduledBackups = async () => {
    try {
      const response = await axios.get(`${API}/backups/scheduled`);
      setScheduledBackups(response.data.backups || []);
    } catch (error) {
      // Backups may not exist yet
    }
  };

  const fetchGithubInfo = async () => {
    try {
      const response = await axios.get(`${API}/github/info`);
      setGithubInfo(response.data);
      if (response.data.repo_url) {
        setGithubUrl(response.data.repo_url);
      }
    } catch (error) {
      // GitHub not configured yet
      setGithubInfo(null);
    }
  };

  const handleSaveGithubUrl = async () => {
    if (!githubUrl) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/github/configure`, { repo_url: githubUrl });
      toast.success('GitHub repository configured successfully');
      fetchGithubInfo();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save GitHub URL');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeploymentLogs = async () => {
    try {
      const response = await axios.get(`${API}/github/deployment-logs`);
      setDeploymentLogs(response.data.logs || []);
    } catch (error) {
      // Logs may not exist yet
    }
  };

  const handleViewLog = async (logFile) => {
    try {
      const response = await axios.get(`${API}/github/deployment-log/${encodeURIComponent(logFile)}`);
      setSelectedLogContent(response.data.content || 'No content available');
      setShowLogDialog(true);
    } catch (error) {
      toast.error('Failed to load log file');
    }
  };

  const handlePullFromGitHub = async () => {
    setPulling(true);
    setPullSuccess(false);
    try {
      const response = await axios.post(`${API}/github/pull`);
      if (response.data.success) {
        toast.success(response.data.message || 'Successfully pulled latest code!');
        setPullSuccess(true);
        
        // Refresh logs and info
        setTimeout(() => {
          fetchGithubInfo();
          fetchDeploymentLogs();
        }, 1000);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pull from GitHub');
      setPullSuccess(false);
    } finally {
      setPulling(false);
    }
  };

  const handleDeploy = async () => {
    if (!window.confirm('This will install dependencies and restart services. The application will be unavailable for 30-60 seconds. Continue?')) return;
    
    setDeploying(true);
    try {
      const response = await axios.post(`${API}/github/deploy`);
      toast.success(response.data.message || 'Deployment started successfully');
      setPullSuccess(false); // Reset after deploy
      
      // Refresh logs and info
      setTimeout(() => {
        fetchGithubInfo();
        fetchDeploymentLogs();
      }, 2000);
      
      // Auto-refresh logs every 5 seconds for 30 seconds
      let refreshCount = 0;
      const refreshInterval = setInterval(() => {
        fetchDeploymentLogs();
        refreshCount++;
        if (refreshCount >= 6) {
          clearInterval(refreshInterval);
        }
      }, 5000);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deploy update');
    } finally {
      setDeploying(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const response = await axios.get(`${API}/backups/download/${filename}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Backup downloaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download backup');
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm('This will restore the backup and restart services. Current data will be replaced. Continue?')) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/backups/restore/${filename}`);
      toast.success(response.data.message || 'Backup restored successfully');
      
      // Refresh backup list
      setTimeout(() => fetchBackups(), 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBackupSettings = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/backups/settings`, backupSettings);
      toast.success('Backup schedule updated successfully');
      fetchBackupSettings();
    } catch (error) {
      toast.error('Failed to update backup settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBackupNow = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/backups/run-now`);
      toast.success('Backup started successfully');
      setTimeout(() => fetchScheduledBackups(), 2000);
    } catch (error) {
      toast.error('Failed to start backup');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = (service) => {
    setSelectedService(service);
    setKeyFormData({});
    setDialogOpen(true);
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/settings/api-keys`, {
        service_name: selectedService,
        credentials: keyFormData
      });
      toast.success('API key saved successfully');
      setDialogOpen(false);
      fetchApiKeys();
      setKeyFormData({});
    } catch (error) {
      console.error('API Key Save Error:', error.response || error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to save API key';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (serviceName) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) return;
    try {
      await axios.delete(`${API}/settings/api-keys/${serviceName}`);
      toast.success('API key deleted');
      fetchApiKeys();
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const handleVerifyKey = async (serviceName) => {
    try {
      const response = await axios.post(`${API}/settings/api-keys/${serviceName}/verify`);
      if (response.data.status === 'success') {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to verify API key');
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/backups/create`);
      toast.success('Backup created successfully');
      fetchBackups();
    } catch (error) {
      toast.error('Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const services = [
    {
      name: 'sendgrid',
      title: 'SendGrid',
      description: 'Email delivery and contact management',
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password' },
        { key: 'sender_email', label: 'Sender Email', type: 'email' }
      ]
    },
    {
      name: 'smtp2go',
      title: 'SMTP2GO',
      description: 'SMTP email delivery service',
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password' },
        { key: 'sender_email', label: 'Sender Email', type: 'email' },
        { key: 'sender_name', label: 'Sender Name', type: 'text' }
      ]
    },
    {
      name: 'github',
      title: 'GitHub',
      description: 'Repository updates and version control',
      fields: [
        { key: 'repo_url', label: 'Repository URL', type: 'text' },
        { key: 'token', label: 'Access Token', type: 'password' }
      ]
    }
  ];

  const getServiceConfig = (serviceName) => {
    return services.find((s) => s.name === serviceName);
  };

  if (user.role !== 'admin') {
    return (
      <div className="space-y-8">
        <Card className="glass">
          <CardContent className="text-center py-12">
            <p className="text-gray-500">Admin access required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="settings-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Settings</h1>
        <p className="text-gray-600">Manage API keys and system configuration</p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api-keys" data-testid="api-keys-tab">API Keys</TabsTrigger>
          <TabsTrigger value="backups" data-testid="backups-tab">Backups</TabsTrigger>
          <TabsTrigger value="scheduler" data-testid="scheduler-tab">Backup Scheduler</TabsTrigger>
          <TabsTrigger value="updates" data-testid="updates-tab">Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service) => {
              const existingKey = apiKeys.find((k) => k.service_name === service.name);
              return (
                <Card key={service.name} className="glass card-hover" data-testid="api-key-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{service.title}</CardTitle>
                        <CardDescription className="mt-1">{service.description}</CardDescription>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-full">
                        <Key className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {existingKey ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <Check className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-gray-600">Configured</span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyKey(service.name)}
                            className="flex-1"
                            data-testid="verify-key-btn"
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddKey(service.name)}
                            className="flex-1"
                            data-testid="edit-key-btn"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteKey(service.name)}
                            data-testid="delete-key-btn"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleAddKey(service.name)}
                        className="w-full"
                        data-testid="add-key-btn"
                      >
                        Add API Key
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Backup Management</CardTitle>
                  <CardDescription>Create and manage system backups</CardDescription>
                </div>
                <Button
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="btn-transition"
                  data-testid="create-backup-btn"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {backups.length > 0 ? (
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex justify-between items-center p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                      data-testid="backup-item"
                    >
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {new Date(backup.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Created by {backup.created_by} • {(backup.size_bytes / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadBackup(backup.filename)}
                          data-testid="download-backup-btn"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreBackup(backup.filename)}
                          className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                          data-testid="restore-backup-btn"
                        >
                          <GitBranch className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No backups created yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Automated Backup Scheduler</CardTitle>
                  <CardDescription>Schedule automatic backups and set retention policy</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Backup Frequency</Label>
                  <Select
                    value={backupSettings.frequency}
                    onValueChange={(value) => setBackupSettings({ ...backupSettings, frequency: value })}
                  >
                    <SelectTrigger data-testid="frequency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (2:00 AM)</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday 2:00 AM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention">Retention (Number of Backups)</Label>
                  <Input
                    id="retention"
                    type="number"
                    min="1"
                    max="365"
                    value={backupSettings.retention}
                    onChange={(e) => setBackupSettings({ ...backupSettings, retention: parseInt(e.target.value) })}
                    data-testid="retention-input"
                  />
                  <p className="text-xs text-gray-600">Keep the last {backupSettings.retention} backup(s)</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={handleUpdateBackupSettings}
                  disabled={loading}
                  className="btn-transition"
                  data-testid="save-schedule-btn"
                >
                  Save Schedule
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRunBackupNow}
                  disabled={loading}
                  className="btn-transition"
                  data-testid="run-backup-now-btn"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Run Backup Now
                </Button>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Scheduled Backups History
                </h3>
                {scheduledBackups.length > 0 ? (
                  <div className="space-y-3">
                    {scheduledBackups.map((backup, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        data-testid="scheduled-backup-item"
                      >
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{backup.filename}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(backup.created_at).toLocaleString()} • {(backup.size_bytes / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="badge badge-success">Completed</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadBackup(backup.filename)}
                            data-testid="download-scheduled-backup-btn"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No scheduled backups yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                  <GitBranch className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle>GitHub Auto-Update</CardTitle>
                  <CardDescription>Pull and deploy latest release from your GitHub repository</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GitHub URL Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github-url" className="text-base font-semibold">
                    GitHub Repository URL
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="github-url"
                      type="text"
                      placeholder="https://github.com/username/repository"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="flex-1"
                      data-testid="github-url-input"
                    />
                    <Button
                      onClick={handleSaveGithubUrl}
                      disabled={loading || !githubUrl}
                      className="btn-transition"
                      data-testid="save-github-url-btn"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Enter the full URL to your GitHub repository (e.g., https://github.com/owner/repo)
                  </p>
                </div>

                {githubInfo?.configured && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Installed Version</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {githubInfo.current_version || githubInfo.current_commit || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Commit: {githubInfo.current_commit || 'Unknown'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">GitHub Latest</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {githubInfo.latest_release ? githubInfo.latest_release.tag_name : 'No releases'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {githubInfo.latest_release ? githubInfo.latest_release.name : 'Check main branch'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {pullSuccess ? '✓ Ready to Deploy' : 
                           githubInfo.current_commit === 'Unknown' ? '⚠️ Version Unknown' :
                           '✓ Connected'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Repository: {githubInfo.owner}/{githubInfo.repo}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-4 pt-4">
                      {/* Pull Button */}
                      <div>
                        <Button
                          onClick={handlePullFromGitHub}
                          disabled={pulling}
                          className="btn-transition bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 w-full"
                          data-testid="pull-btn"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {pulling ? 'Pulling from GitHub...' : 'Step 1: Pull Latest Code'}
                        </Button>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          Fetches the latest code from GitHub repository without affecting running services
                        </p>
                      </div>

                      {/* Deploy Button - Only enabled after successful pull */}
                      <div>
                        <Button
                          onClick={handleDeploy}
                          disabled={deploying || !pullSuccess}
                          className={`btn-transition w-full ${
                            pullSuccess 
                              ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                          data-testid="deploy-btn"
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          {deploying ? 'Deploying...' : 'Step 2: Deploy & Restart Services'}
                        </Button>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          {pullSuccess 
                            ? '✓ Ready to deploy! This will install dependencies and restart services.' 
                            : '⚠ Pull code first before deploying'}
                        </p>
                      </div>

                      {/* Check for Updates Button */}
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          onClick={() => {
                            fetchGithubInfo();
                            toast.success('Checking for updates...');
                          }}
                          className="btn-transition w-full"
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          Check for Updates
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>⚠️ Two-Step Update Process:</strong>
                      </p>
                      <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 mt-2 space-y-1">
                        <li><strong>Step 1 - Pull:</strong> Safely downloads latest code (no downtime)</li>
                        <li><strong>Step 2 - Deploy:</strong> Installs dependencies and restarts (30-60s downtime)</li>
                        <li>Always pull first to verify code downloads successfully</li>
                        <li>Check the logs below for detailed progress</li>
                      </ul>
                    </div>

                    {/* Deployment Logs Section */}
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        System Update Log
                      </h3>
                      {deploymentLogs.length > 0 ? (
                        <div className="space-y-2">
                          {deploymentLogs.map((log, index) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                              onClick={() => handleViewLog(log.log_file)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      Deployment by {log.user}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      log.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      log.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                      {log.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {new Date(log.timestamp).toLocaleString()} • {log.repository}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm">
                                  View Log →
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No deployment logs yet</p>
                          <p className="text-sm mt-1">Logs will appear here after your first deployment</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="api-key-dialog">
          <DialogHeader>
            <DialogTitle>Configure {getServiceConfig(selectedService)?.title}</DialogTitle>
            <DialogDescription>
              {getServiceConfig(selectedService)?.description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveKey} className="space-y-4">
            {getServiceConfig(selectedService)?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={keyFormData[field.key] || ''}
                  onChange={(e) => setKeyFormData({ ...keyFormData, [field.key]: e.target.value })}
                  required
                  data-testid={`${field.key}-input`}
                />
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={loading} data-testid="save-key-btn">
              {loading ? 'Saving...' : 'Save API Key'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deployment Log Viewer Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Deployment Log</DialogTitle>
            <DialogDescription>
              Detailed deployment process log
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg font-mono overflow-auto">
              {selectedLogContent}
            </pre>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowLogDialog(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;