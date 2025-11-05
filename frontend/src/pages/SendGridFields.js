import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Database, Tag } from 'lucide-react';
import NotConfigured from '../components/NotConfigured';

const SendGridFields = () => {
  const [fields, setFields] = useState([]);
  const [sendgridConfigured, setSendgridConfigured] = useState(true);
  const [reservedFields, setReservedFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);

  useEffect(() => {
    checkSendGridConfig();
    fetchFields();
  }, []);

  const checkSendGridConfig = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      const sendgridKey = response.data.find(key => key.service_name === 'sendgrid');
      setSendgridConfigured(sendgridKey && sendgridKey.is_active !== false);
    } catch (error) {
      setSendgridConfigured(false);
    }
  };

  const fetchFields = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/sendgrid/fields`);
      setFields(response.data.fields || []);
      setReservedFields(response.data.reserved || []);
      setCustomFields(response.data.custom || []);
      setSyncedAt(response.data.synced_at);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch SendGrid fields');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(`${API}/sendgrid/sync-fields`);
      toast.success(response.data.message);
      await fetchFields();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync SendGrid fields');
    } finally {
      setSyncing(false);
    }
  };

  const getFieldTypeColor = (type) => {
    const colors = {
      'Text': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Number': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Date': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const FieldTable = ({ fields, title, emptyMessage }) => (
    <div className="space-y-4">
      {fields.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Field ID</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Field Name</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr
                  key={field.id || index}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="p-3">
                    <code className="code-display text-xs px-2 py-1">
                      {field.field_id}
                    </code>
                  </td>
                  <td className="p-3 text-sm text-gray-800 dark:text-gray-200">
                    {field.field_name}
                  </td>
                  <td className="p-3">
                    <Badge className={`${getFieldTypeColor(field.field_type)} text-xs`}>
                      {field.field_type}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!sendgridConfigured) {
    return <NotConfigured service="SendGrid" />;
  }

  return (
    <div className="space-y-6" data-testid="sendgrid-fields-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">SendGrid Field Definitions</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and view SendGrid field definitions for webhook mapping
          </p>
          {syncedAt && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last synced: {new Date(syncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Fields'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Fields</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{fields.length}</p>
              </div>
              <Database className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Reserved Fields</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{reservedFields.length}</p>
              </div>
              <Tag className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Custom Fields</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{customFields.length}</p>
              </div>
              <Tag className="h-10 w-10 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {fields.length === 0 ? (
        <Card className="glass border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardContent className="text-center py-12">
            <Database className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Fields Synced Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Click "Sync Fields" to fetch field definitions from SendGrid
            </p>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Field Definitions</CardTitle>
            <CardDescription>
              Browse all SendGrid fields available for webhook mapping
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All Fields ({fields.length})</TabsTrigger>
                <TabsTrigger value="reserved">Reserved ({reservedFields.length})</TabsTrigger>
                <TabsTrigger value="custom">Custom ({customFields.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-4">
                <FieldTable
                  fields={fields}
                  title="All Fields"
                  emptyMessage="No fields available"
                />
              </TabsContent>
              
              <TabsContent value="reserved" className="mt-4">
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Reserved Fields</strong> are standard SendGrid contact fields. These are built-in and available to all SendGrid accounts.
                  </p>
                </div>
                <FieldTable
                  fields={reservedFields}
                  title="Reserved Fields"
                  emptyMessage="No reserved fields available"
                />
              </TabsContent>
              
              <TabsContent value="custom" className="mt-4">
                <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    <strong>Custom Fields</strong> are created in your SendGrid account for storing additional contact information. Field IDs typically follow the pattern e#_T (text), e#_N (number), or e#_D (date).
                  </p>
                </div>
                <FieldTable
                  fields={customFields}
                  title="Custom Fields"
                  emptyMessage="No custom fields found. Create custom fields in your SendGrid account and sync again."
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SendGridFields;