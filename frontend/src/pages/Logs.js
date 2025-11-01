import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Download, FileText, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEndpoints();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedEndpoint]);

  const fetchEndpoints = async () => {
    try {
      const response = await axios.get(`${API}/webhooks/endpoints`);
      setEndpoints(response.data);
    } catch (error) {
      toast.error('Failed to fetch endpoints');
    }
  };

  const fetchLogs = async () => {
    try {
      const url =
        selectedEndpoint === 'all'
          ? `${API}/webhooks/logs?limit=100`
          : `${API}/webhooks/logs?limit=100&endpoint_id=${selectedEndpoint}`;
      const response = await axios.get(url);
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLogs();
      toast.success('Logs refreshed');
    } catch (error) {
      toast.error('Failed to refresh logs');
    } finally {
      setRefreshing(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Endpoint', 'Status', 'Source IP', 'Payload', 'Response'];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.endpoint_name,
      log.status,
      log.source_ip || 'N/A',
      log.payload_summary,
      log.response_message
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-logs-${new Date().toISOString()}.csv`;
    a.click();
    toast.success('CSV exported successfully');
  };

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) return;
    
    try {
      const response = await axios.delete(`${API}/webhooks/logs`);
      toast.success(response.data.message || 'Logs cleared successfully');
      setLogs([]);
      fetchLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clear logs');
    }
  };

  const handleRetry = async (logId) => {
    setRetrying(true);
    try {
      const response = await axios.post(`${API}/webhooks/logs/${logId}/retry`);
      toast.success(response.data.message || 'Webhook retried successfully');
      setDialogOpen(false);
      fetchLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to retry webhook');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="logs-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Webhook Logs</h1>
          <p className="text-gray-600 dark:text-gray-400">View and export webhook request logs</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="btn-transition" 
            data-testid="refresh-logs-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            onClick={handleClearLogs} 
            variant="destructive"
            className="btn-transition" 
            data-testid="clear-logs-btn"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
          <Button onClick={exportCSV} className="btn-transition" data-testid="export-csv-btn">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filter Logs</CardTitle>
            <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
              <SelectTrigger className="w-64" data-testid="filter-endpoint-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Endpoints</SelectItem>
                {endpoints.map((endpoint) => (
                  <SelectItem key={endpoint.id} value={endpoint.id}>
                    {endpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card className="glass" data-testid="logs-table-card">
        <CardContent className="p-0">
          {logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Response
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800" 
                      data-testid="log-row"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {log.status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          ) : log.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500 mr-2" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                          )}
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
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleLogClick(log)}>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.endpoint_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleLogClick(log)}>
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleLogClick(log)}>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{log.source_ip || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleLogClick(log)}>
                        <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {log.response_message || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(log.id);
                            }}
                            disabled={retrying}
                            className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No logs found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="log-detail-dialog">
          <DialogHeader>
            <DialogTitle>Webhook Log Details</DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-600 mb-1">Status</h4>
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
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-2">Payload (Full Request)</h4>
                {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 ? (
                  <pre className="code-display text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words p-3 rounded bg-gray-100 dark:bg-gray-800">
                    {typeof selectedLog.payload === 'string' 
                      ? selectedLog.payload 
                      : JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No payload data available</p>
                )}
              </div>

              {selectedLog.status === 'failed' && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => handleRetry(selectedLog.id)}
                    disabled={retrying}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {retrying ? 'Retrying...' : 'Retry This Webhook'}
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    This will resend the webhook with the same payload
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Logs;