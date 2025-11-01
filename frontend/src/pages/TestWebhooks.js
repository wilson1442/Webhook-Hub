import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Play, Copy, RefreshCw, Zap, Terminal } from 'lucide-react';

const TestWebhooks = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [payload, setPayload] = useState('{\n  "email": "test@example.com",\n  "firstname": "John",\n  "lastname": "Doe"\n}');
  const [curlCommand, setCurlCommand] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchEndpoints();
  }, []);

  useEffect(() => {
    if (selectedEndpoint) {
      generateCurlCommand();
    }
  }, [selectedEndpoint, payload]);

  // Separate useEffect for auto-generating sample payload only on endpoint change
  useEffect(() => {
    if (selectedEndpoint) {
      generateSamplePayload();
    }
  }, [selectedEndpoint]); // Only runs when endpoint changes, not on payload edit

  const generateSamplePayload = () => {
    if (!selectedEndpoint || !selectedEndpoint.field_mapping) return;
    
    const sampleData = {};
    
    // Iterate through field_mapping to generate sample data
    Object.entries(selectedEndpoint.field_mapping).forEach(([sendgridField, config]) => {
      // Handle both old format (string) and new format (object)
      const payloadField = typeof config === 'string' ? config : config.payload_field;
      
      // Generate sample data based on field name
      if (payloadField.toLowerCase().includes('email')) {
        sampleData[payloadField] = 'test@example.com';
      } else if (payloadField.toLowerCase().includes('first') || payloadField.toLowerCase().includes('fname')) {
        sampleData[payloadField] = 'John';
      } else if (payloadField.toLowerCase().includes('last') || payloadField.toLowerCase().includes('lname')) {
        sampleData[payloadField] = 'Doe';
      } else if (payloadField.toLowerCase().includes('phone')) {
        sampleData[payloadField] = '+1234567890';
      } else if (payloadField.toLowerCase().includes('company')) {
        sampleData[payloadField] = 'Acme Corp';
      } else if (payloadField.toLowerCase().includes('city')) {
        sampleData[payloadField] = 'New York';
      } else if (payloadField.toLowerCase().includes('state')) {
        sampleData[payloadField] = 'NY';
      } else if (payloadField.toLowerCase().includes('country')) {
        sampleData[payloadField] = 'USA';
      } else if (payloadField.toLowerCase().includes('zip') || payloadField.toLowerCase().includes('postal')) {
        sampleData[payloadField] = '10001';
      } else if (payloadField.toLowerCase().includes('address')) {
        sampleData[payloadField] = '123 Main Street';
      } else if (sendgridField.match(/e\d+_N/)) {
        // Number custom field
        sampleData[payloadField] = 12345;
      } else {
        // Default text value
        sampleData[payloadField] = `Sample ${payloadField}`;
      }
    });
    
    // Always update with new sample data when called
    if (Object.keys(sampleData).length > 0) {
      const newPayload = JSON.stringify(sampleData, null, 2);
      setPayload(newPayload);
    }
  };

  const fetchEndpoints = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/webhooks/endpoints`);
      setEndpoints(response.data);
      if (response.data.length > 0) {
        setSelectedEndpoint(response.data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch endpoints');
    } finally {
      setLoading(false);
    }
  };

  const generateCurlCommand = () => {
    if (!selectedEndpoint) return;
    
    const url = `${window.location.origin}/api/hooks/${selectedEndpoint.path}`;
    const token = selectedEndpoint.secret_token;
    
    const command = `curl -X POST '${url}' \\
  -H 'X-Webhook-Token: ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '${payload.replace(/\n/g, ' ').replace(/\s+/g, ' ')}'`;
    
    setCurlCommand(command);
  };

  const executeWebhook = async () => {
    if (!selectedEndpoint) {
      toast.error('Please select an endpoint');
      return;
    }

    setExecuting(true);
    setResponse(null);

    try {
      const parsedPayload = JSON.parse(payload);
      const url = `${window.location.origin}/api/hooks/${selectedEndpoint.path}`;
      
      const startTime = Date.now();
      const result = await axios.post(url, parsedPayload, {
        headers: {
          'X-Webhook-Token': selectedEndpoint.secret_token,
          'Content-Type': 'application/json'
        }
      });
      const endTime = Date.now();

      setResponse({
        success: true,
        status: result.status,
        statusText: result.statusText,
        data: result.data,
        time: endTime - startTime,
        timestamp: new Date().toISOString()
      });

      toast.success('Webhook executed successfully!');
    } catch (error) {
      const endTime = Date.now();
      setResponse({
        success: false,
        status: error.response?.status || 0,
        statusText: error.response?.statusText || 'Network Error',
        data: error.response?.data || { error: error.message },
        time: 0,
        timestamp: new Date().toISOString()
      });
      toast.error(`Request failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const loadExamplePayload = (type) => {
    const examples = {
      basic: '{\n  "email": "test@example.com",\n  "firstname": "John",\n  "lastname": "Doe"\n}',
      full: '{\n  "email": "test@example.com",\n  "firstname": "Jane",\n  "lastname": "Smith",\n  "phone": "+1234567890",\n  "company": "Acme Corp",\n  "city": "New York",\n  "country": "USA"\n}',
      minimal: '{\n  "email": "minimal@example.com"\n}'
    };
    setPayload(examples[type]);
    toast.success(`Loaded ${type} example payload`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="test-webhooks-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Test Webhooks</h1>
        <p className="text-gray-600 dark:text-gray-400">Test your webhook endpoints with custom payloads and see real-time responses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Endpoint Selection */}
          <Card className="glass card-hover">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2 text-blue-500" />
                Select Endpoint
              </CardTitle>
              <CardDescription>Choose the webhook endpoint you want to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoints.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <Label>Webhook Endpoint</Label>
                    <Select
                      value={selectedEndpoint?.id}
                      onValueChange={(value) => {
                        const endpoint = endpoints.find(e => e.id === value);
                        setSelectedEndpoint(endpoint);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {endpoints.map((endpoint) => (
                          <SelectItem key={endpoint.id} value={endpoint.id}>
                            {endpoint.name} - /{endpoint.path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedEndpoint && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Endpoint URL</p>
                      <code className="text-sm font-mono text-blue-700 dark:text-blue-300 break-all">
                        {window.location.origin}/api/hooks/{selectedEndpoint.path}
                      </code>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-1">Mode</p>
                      <span className="badge badge-info text-xs">
                        {selectedEndpoint.mode === 'add_contact' ? 'Add Contact to List' : 'Send Email via Template'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No webhook endpoints found</p>
                  <Button onClick={() => window.location.href = '/webhooks'}>
                    Create Endpoint
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payload Editor */}
          {selectedEndpoint && (
            <Card className="glass card-hover">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Request Payload</CardTitle>
                    <CardDescription>Edit the JSON payload to send</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateSamplePayload()}
                      className="text-xs"
                      title="Generate sample data from field mapping"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Auto-Fill
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <textarea
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    className="w-full h-48 p-3 font-mono text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder='{"email": "test@example.com"}'
                  />
                </div>

                {selectedEndpoint.field_mapping && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                      {selectedEndpoint.mode === 'add_contact' ? 'Expected Fields (Contact Data):' : 'Template Variables (dynamic_template_data):'}
                    </p>
                    <div className="space-y-1">
                      {Object.entries(selectedEndpoint.field_mapping).map(([sendgrid, config]) => {
                        // Handle both old format (string) and new format (object)
                        const payloadField = typeof config === 'string' ? config : config.payload_field;
                        const isCustom = typeof config === 'object' && config.is_custom;
                        
                        return (
                          <div key={sendgrid} className="text-xs text-gray-700 dark:text-gray-300">
                            <code className="bg-white dark:bg-gray-800 px-1 rounded">{payloadField}</code>
                            <span className="mx-1 text-gray-400">→</span>
                            <code className="bg-white dark:bg-gray-800 px-1 rounded">{sendgrid}</code>
                            {isCustom && (
                              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Custom)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {selectedEndpoint.mode === 'send_email' && (
                      <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                        <p className="text-xs text-green-700 dark:text-green-400">
                          💡 <strong>Note:</strong> For email templates, your entire payload is sent as dynamic_template_data to SendGrid. 
                          Use these fields in your template like: <code className="bg-white dark:bg-gray-800 px-1 rounded">{'{{email}}'}</code> or <code className="bg-white dark:bg-gray-800 px-1 rounded">{'{{first_name}}'}</code>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={executeWebhook}
                  disabled={executing}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {executing ? 'Executing...' : 'Execute Webhook'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* cURL Command */}
          {selectedEndpoint && (
            <Card className="glass card-hover">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <Terminal className="h-5 w-5 mr-2 text-purple-500" />
                      cURL Command
                    </CardTitle>
                    <CardDescription>Copy this command to use in your terminal</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(curlCommand)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="code-display text-xs overflow-x-auto whitespace-pre-wrap break-words p-3 rounded bg-gray-900 dark:bg-gray-950 text-green-400">
                  {curlCommand}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Response */}
          {response && (
            <Card className={`glass card-hover border-2 ${response.success ? 'border-green-500' : 'border-red-500'}`}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {response.success ? (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <div className="h-3 w-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Response - Success
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <div className="h-3 w-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                      Response - Failed
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  Status: {response.status} {response.statusText} | Time: {response.time}ms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="formatted">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="formatted">Formatted</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="formatted" className="space-y-3">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {Object.entries(response.data).map(([key, value]) => (
                        <div key={key} className="mb-2 last:mb-0">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            {key}:
                          </span>
                          <div className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="raw">
                    <pre className="code-display text-xs overflow-x-auto whitespace-pre-wrap break-words p-3 rounded bg-gray-900 dark:bg-gray-950 text-gray-100">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </TabsContent>
                </Tabs>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {new Date(response.timestamp).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          )}

          {!response && selectedEndpoint && (
            <Card className="glass border-dashed border-2 border-gray-300 dark:border-gray-600">
              <CardContent className="text-center py-12">
                <Terminal className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  Execute the webhook to see the response here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestWebhooks;
