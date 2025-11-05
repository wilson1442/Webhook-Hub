import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { FileText, Mail, RefreshCw, ExternalLink } from 'lucide-react';
import NotConfigured from '../components/NotConfigured';

const SendGridTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendgridConfigured, setSendgridConfigured] = useState(true);

  useEffect(() => {
    checkSendGridConfig();
    checkApiKey();
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Filter templates based on search query
    if (searchQuery.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const filtered = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTemplates(filtered);
    }
  }, [searchQuery, templates]);

  const checkSendGridConfig = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      const sendgridKey = response.data.find(key => key.service_name === 'sendgrid');
      setSendgridConfigured(sendgridKey && sendgridKey.is_active !== false);
    } catch (error) {
      setSendgridConfigured(false);
    }
  };

  const checkApiKey = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      const sendgridKey = response.data.find(k => k.service_name === 'sendgrid');
      setHasApiKey(!!sendgridKey);
    } catch (error) {
      setHasApiKey(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/sendgrid/templates`);
      setTemplates(response.data.templates || []);
      setFilteredTemplates(response.data.templates || []);
    } catch (error) {
      toast.error('Failed to fetch SendGrid templates');
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

  if (!sendgridConfigured) {
    return <NotConfigured service="SendGrid" />;
  }

  if (!hasApiKey) {
    return (
      <div className="space-y-8" data-testid="sendgrid-templates-page">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SendGrid Templates</h1>
          <p className="text-gray-600">Manage your SendGrid email templates</p>
        </div>
        <Card className="glass">
          <CardContent className="text-center py-12">
            <div className="p-4 bg-purple-100 rounded-full inline-block mb-4">
              <Mail className="h-12 w-12 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">SendGrid Not Configured</h3>
            <p className="text-gray-600 mb-4">
              Add your SendGrid API key in Settings to view and manage templates
            </p>
            <Button onClick={() => window.location.href = '/settings'} data-testid="go-to-settings-btn">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="sendgrid-templates-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SendGrid Templates</h1>
          <p className="text-gray-600">Manage your SendGrid email templates</p>
        </div>
        <div className="flex space-x-2">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
            data-testid="search-templates-input"
          />
          <Button
            variant="outline"
            onClick={fetchTemplates}
            className="btn-transition"
            data-testid="refresh-templates-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('https://mc.sendgrid.com/dynamic-templates', '_blank')}
            data-testid="manage-sendgrid-btn"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage in SendGrid
          </Button>
        </div>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="glass card-hover" data-testid="template-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.versions?.length || 0} version(s)
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p><strong>ID:</strong> <code className="text-xs bg-gray-100 px-2 py-1 rounded">{template.id}</code></p>
                  {template.updated_at && (
                    <p className="mt-2"><strong>Updated:</strong> {new Date(template.updated_at).toLocaleDateString()}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(`https://mc.sendgrid.com/dynamic-templates/${template.id}`, '_blank')}
                  data-testid="view-template-btn"
                >
                  View in SendGrid
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No templates found</p>
            <Button
              onClick={() => window.open('https://mc.sendgrid.com/dynamic-templates', '_blank')}
              data-testid="create-template-btn"
            >
              Create Template in SendGrid
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SendGridTemplates;
