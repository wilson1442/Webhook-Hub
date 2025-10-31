import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Activity, CheckCircle, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Endpoints',
      value: stats?.total_endpoints || 0,
      icon: Zap,
      color: 'from-blue-500 to-cyan-500',
      testId: 'total-endpoints-stat'
    },
    {
      title: 'Total Requests',
      value: stats?.total_requests || 0,
      icon: Activity,
      color: 'from-purple-500 to-pink-500',
      testId: 'total-requests-stat'
    },
    {
      title: 'Success Rate',
      value: `${stats?.success_rate || 0}%`,
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      testId: 'success-rate-stat'
    },
    {
      title: 'Failed Requests',
      value: stats?.failed_requests || 0,
      icon: XCircle,
      color: 'from-red-500 to-orange-500',
      testId: 'failed-requests-stat'
    },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Monitor your webhook gateway activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card
            key={stat.title}
            className="glass card-hover slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
            data-testid={stat.testId}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="glass" data-testid="recent-activity-card">
        <CardHeader>
          <CardTitle className="text-2xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_activity?.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_activity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedLog(log);
                    setDialogOpen(true);
                  }}
                  data-testid="activity-log-item"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-full ${
                        log.status === 'success'
                          ? 'bg-green-100 dark:bg-green-900'
                          : log.status === 'failed'
                          ? 'bg-red-100 dark:bg-red-900'
                          : 'bg-yellow-100 dark:bg-yellow-900'
                      }`}
                    >
                      {log.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : log.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <Activity className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{log.endpoint_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      log.status === 'success'
                        ? 'badge-success'
                        : log.status === 'failed'
                        ? 'badge-error'
                        : 'badge-warning'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Status</h4>
                <span
                  className={`badge ${
                    selectedLog.status === 'success'
                      ? 'badge-success'
                      : selectedLog.status === 'failed'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}
                >
                  {selectedLog.status}
                </span>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Endpoint</h4>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedLog.endpoint_name}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Source IP</h4>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedLog.source_ip || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Response Message</h4>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedLog.response_message || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Payload</h4>
                <pre className="code-display text-xs overflow-x-auto max-h-64">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;