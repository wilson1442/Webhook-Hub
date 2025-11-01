import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Copy, RefreshCw, Trash2, Edit, Check, ChevronDown, ChevronUp, X, Mail } from 'lucide-react';

const Webhooks = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [collapsedCards, setCollapsedCards] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({
    add_contact: true,
    send_email: true
  });
  const [sendgridLists, setSendgridLists] = useState([]);
  const [sendgridTemplates, setSendgridTemplates] = useState([]);
  const [sendgridFields, setSendgridFields] = useState([]);
  const [templateKeys, setTemplateKeys] = useState([]);
  const [loadingTemplateKeys, setLoadingTemplateKeys] = useState(false);
  const [activeIntegrations, setActiveIntegrations] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    mode: 'add_contact',
    integration: 'sendgrid',
    field_mapping: {
      email: { payload_field: 'email', is_custom: false }
    },
    sendgrid_list_id: '',
    sendgrid_template_id: '',
    email_from: '',
    email_from_name: ''
  });

  useEffect(() => {
    fetchEndpoints();
    fetchSendgridData();
    fetchActiveIntegrations();
  }, []);

  const fetchEndpoints = async () => {
    try {
      const response = await axios.get(`${API}/webhooks/endpoints`);
      setEndpoints(response.data);
      
      // Initialize all cards as collapsed (true = collapsed)
      const initialCollapsed = {};
      response.data.forEach(endpoint => {
        initialCollapsed[endpoint.id] = true;
      });
      setCollapsedCards(initialCollapsed);
    } catch (error) {
      toast.error('Failed to fetch endpoints');
    } finally {
      setLoading(false);
    }
  };

  const fetchSendgridData = async () => {
    try {
      const [lists, templates, fields] = await Promise.all([
        axios.get(`${API}/sendgrid/lists`),
        axios.get(`${API}/sendgrid/templates`),
        axios.get(`${API}/sendgrid/fields`)
      ]);
      setSendgridLists(lists.data.lists || []);
      setSendgridTemplates(templates.data.templates || []);
      setSendgridFields(fields.data.fields || []);
    } catch (error) {
      // SendGrid not configured yet or fields not synced
    }
  };

  const fetchActiveIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      // Filter to only active integrations
      const active = response.data.filter(key => key.is_active !== false);
      setActiveIntegrations(active);
    } catch (error) {
      // No integrations configured
    }
  };

  const fetchTemplateKeys = async (templateId) => {
    if (!templateId) {
      setTemplateKeys([]);
      return;
    }
    
    setLoadingTemplateKeys(true);
    try {
      const response = await axios.get(`${API}/sendgrid/templates/${templateId}`);
      setTemplateKeys(response.data.template_keys || []);
      if (response.data.template_keys && response.data.template_keys.length > 0) {
        toast.success(`Found ${response.data.template_keys.length} template keys`);
      }
    } catch (error) {
      toast.error('Failed to fetch template keys');
      setTemplateKeys([]);
    } finally {
      setLoadingTemplateKeys(false);
    }
  };

  // Normalize field mapping for backward compatibility
  const normalizeFieldMapping = (mapping) => {
    const normalized = {};
    Object.entries(mapping).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Old format: {"first_name": "firstname"}
        normalized[key] = { payload_field: value, is_custom: false };
      } else {
        // New format: {"first_name": {"payload_field": "firstname", "is_custom": false}}
        normalized[key] = value;
      }
    });
    return normalized;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (editingEndpoint) {
        // Update existing endpoint
        await axios.put(`${API}/webhooks/endpoints/${editingEndpoint.id}`, formData);
        toast.success('Webhook endpoint updated!');
      } else {
        // Create new endpoint
        await axios.post(`${API}/webhooks/endpoints`, formData);
        toast.success('Webhook endpoint created!');
      }
      setDialogOpen(false);
      setEditingEndpoint(null);
      fetchEndpoints();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${editingEndpoint ? 'update' : 'create'} endpoint`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      path: '',
      mode: 'add_contact',
      integration: activeIntegrations.length > 0 ? activeIntegrations[0].service_name : 'sendgrid',
      field_mapping: { email: { payload_field: 'email', is_custom: false } },
      sendgrid_list_id: '',
      sendgrid_template_id: '',
      email_from: '',
      email_from_name: ''
    });
    setTemplateKeys([]);
  };

  const handleEdit = (endpoint) => {
    setEditingEndpoint(endpoint);
    const normalizedMapping = normalizeFieldMapping(endpoint.field_mapping || { email: 'email' });
    
    // For send_email mode, ensure email, cc, and bcc are always present
    if (endpoint.mode === 'send_email') {
      if (!normalizedMapping.email) {
        normalizedMapping.email = { payload_field: 'email', is_custom: false };
      }
      if (!normalizedMapping.cc) {
        normalizedMapping.cc = { payload_field: 'cc', is_custom: false };
      }
      if (!normalizedMapping.bcc) {
        normalizedMapping.bcc = { payload_field: 'bcc', is_custom: false };
      }
    }
    
    setFormData({
      name: endpoint.name,
      path: endpoint.path,
      mode: endpoint.mode,
      integration: endpoint.integration || 'sendgrid',
      field_mapping: normalizedMapping,
      sendgrid_list_id: endpoint.sendgrid_list_id || '',
      sendgrid_template_id: endpoint.sendgrid_template_id || '',
      email_from: endpoint.email_from || '',
      email_from_name: endpoint.email_from_name || ''
    });
    // Fetch template keys if template is selected
    if (endpoint.sendgrid_template_id) {
      fetchTemplateKeys(endpoint.sendgrid_template_id);
    }
    setDialogOpen(true);
  };

  const toggleCollapse = (endpointId) => {
    setCollapsedCards(prev => ({
      ...prev,
      [endpointId]: !prev[endpointId]
    }));
  };

  const toggleGroup = (mode) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [mode]: !prev[mode]
    }));
  };

  const handleDuplicate = (endpoint) => {
    const normalizedMapping = normalizeFieldMapping(endpoint.field_mapping || { email: 'email' });
    setFormData({
      name: `${endpoint.name} (Copy)`,
      path: `${endpoint.path}-copy`,
      mode: endpoint.mode,
      integration: endpoint.integration || 'sendgrid',
      field_mapping: normalizedMapping,
      sendgrid_list_id: endpoint.sendgrid_list_id || '',
      sendgrid_template_id: endpoint.sendgrid_template_id || '',
      email_from: endpoint.email_from || '',
      email_from_name: endpoint.email_from_name || ''
    });
    setEditingEndpoint(null); // Set to null so it creates new instead of editing
    setDialogOpen(true);
    toast.info('Duplicating webhook - modify as needed');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this endpoint?')) return;
    try {
      await axios.delete(`${API}/webhooks/endpoints/${id}`);
      toast.success('Endpoint deleted');
      fetchEndpoints();
    } catch (error) {
      toast.error('Failed to delete endpoint');
    }
  };

  const handleRegenerateToken = async (id) => {
    try {
      const response = await axios.post(`${API}/webhooks/endpoints/${id}/regenerate-token`);
      toast.success('Token regenerated');
      fetchEndpoints();
    } catch (error) {
      toast.error('Failed to regenerate token');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Dynamic field mapping functions
  const addFieldMapping = () => {
    const newField = `field_${Object.keys(formData.field_mapping).length}`;
    setFormData({
      ...formData,
      field_mapping: {
        ...formData.field_mapping,
        [newField]: { payload_field: '', is_custom: false }
      }
    });
  };

  const removeFieldMapping = (fieldKey) => {
    if (fieldKey === 'email') {
      toast.error('Email field is required and cannot be removed');
      return;
    }
    const newMapping = { ...formData.field_mapping };
    delete newMapping[fieldKey];
    setFormData({
      ...formData,
      field_mapping: newMapping
    });
  };

  const updateFieldMappingKey = (oldKey, newKey) => {
    const newMapping = {};
    Object.keys(formData.field_mapping).forEach(key => {
      if (key === oldKey) {
        newMapping[newKey] = formData.field_mapping[key];
      } else {
        newMapping[key] = formData.field_mapping[key];
      }
    });
    setFormData({
      ...formData,
      field_mapping: newMapping
    });
  };

  const updateFieldMappingValue = (key, field, value) => {
    setFormData({
      ...formData,
      field_mapping: {
        ...formData.field_mapping,
        [key]: {
          ...formData.field_mapping[key],
          [field]: value
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="webhooks-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Webhook Endpoints</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your webhook endpoints and integration URLs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingEndpoint(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="btn-transition" data-testid="create-webhook-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="create-webhook-dialog">
            <DialogHeader>
              <DialogTitle>{editingEndpoint ? 'Edit Webhook Endpoint' : 'Create Webhook Endpoint'}</DialogTitle>
              <DialogDescription>
                {editingEndpoint ? 'Update your webhook endpoint configuration' : 'Configure a new webhook endpoint for your integrations'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Endpoint Name</Label>
                  <Input
                    id="name"
                    placeholder="Lead Intake"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="webhook-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="path">URL Path</Label>
                  <Input
                    id="path"
                    placeholder="lead-intake"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    required
                    data-testid="webhook-path-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="integration">Integration</Label>
                <Select
                  value={formData.integration}
                  onValueChange={(value) => setFormData({ ...formData, integration: value })}
                >
                  <SelectTrigger data-testid="webhook-integration-select">
                    <SelectValue placeholder="Select integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeIntegrations.length > 0 ? (
                      activeIntegrations.map((integration) => (
                        <SelectItem key={integration.service_name} value={integration.service_name}>
                          {integration.service_name === 'sendgrid' ? 'SendGrid' : 
                           integration.service_name === 'smtp2go' ? 'SMTP2GO' :
                           integration.service_name.charAt(0).toUpperCase() + integration.service_name.slice(1)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="sendgrid" disabled>No active integrations</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {activeIntegrations.length === 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    ⚠️ No active integrations. <a href="/settings" className="underline">Configure integrations</a> in Settings.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value) => {
                    const newFieldMapping = { ...formData.field_mapping };
                    
                    // For send_email mode, ensure email, cc, and bcc are always present
                    if (value === 'send_email') {
                      if (!newFieldMapping.email) {
                        newFieldMapping.email = { payload_field: 'email', is_custom: false };
                      }
                      if (!newFieldMapping.cc) {
                        newFieldMapping.cc = { payload_field: 'cc', is_custom: false };
                      }
                      if (!newFieldMapping.bcc) {
                        newFieldMapping.bcc = { payload_field: 'bcc', is_custom: false };
                      }
                    }
                    
                    setFormData({ ...formData, mode: value, field_mapping: newFieldMapping });
                  }}
                >
                  <SelectTrigger data-testid="webhook-mode-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_contact">Add Contact to List</SelectItem>
                    <SelectItem value="send_email">Send Email via Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Field Mapping */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Field Mapping</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addFieldMapping}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Map your payload fields to SendGrid fields. Check "Custom" for SendGrid custom fields (e.g., e3_T, e4_T).
                  {sendgridFields.length === 0 && (
                    <span className="block mt-1 text-orange-600 dark:text-orange-400">
                      ⚠️ No SendGrid fields synced yet. <a href="/sendgrid-fields" className="underline">Sync fields</a> to use dropdown selector.
                    </span>
                  )}
                </p>
                
                <div className="space-y-2 border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                  {/* Column Headers */}
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center pb-2 border-b border-gray-300 dark:border-gray-600">
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        SendGrid Field
                      </Label>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Payload Field
                      </Label>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Custom
                      </Label>
                    </div>
                    <div className="w-8"></div>
                  </div>
                  
                  {/* Field Mapping Rows */}
                  {Object.entries(formData.field_mapping).map(([sendgridField, config], index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                      <div>
                        {['email', 'cc', 'bcc'].includes(sendgridField) ? (
                          <Input
                            value={sendgridField}
                            disabled
                            className="text-sm bg-gray-100 dark:bg-gray-800"
                          />
                        ) : formData.integration === 'sendgrid' && formData.mode === 'add_contact' && sendgridFields.length > 0 ? (
                          <Select
                            value={sendgridField}
                            onValueChange={(value) => {
                              // Find the field to determine if it's custom
                              const selectedField = sendgridFields.find(f => f.field_id === value);
                              const isCustom = selectedField ? !selectedField.is_reserved : false;
                              
                              // Update both the field key and is_custom flag
                              const newMapping = {};
                              Object.keys(formData.field_mapping).forEach(key => {
                                if (key === sendgridField) {
                                  newMapping[value] = {
                                    ...formData.field_mapping[key],
                                    is_custom: isCustom
                                  };
                                } else {
                                  newMapping[key] = formData.field_mapping[key];
                                }
                              });
                              setFormData({
                                ...formData,
                                field_mapping: newMapping
                              });
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select SendGrid field" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {sendgridFields.map((field) => (
                                <SelectItem key={field.field_id} value={field.field_id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-mono text-xs">{field.field_id}</span>
                                    <span className="text-gray-600 dark:text-gray-400 text-xs ml-2">
                                      {field.field_name}
                                    </span>
                                    {!field.is_reserved && (
                                      <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Custom)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="e.g., first_name or e3_T"
                            value={sendgridField}
                            onChange={(e) => updateFieldMappingKey(sendgridField, e.target.value)}
                            className="text-sm"
                          />
                        )}
                      </div>
                      <div>
                        <Input
                          placeholder="e.g., firstname"
                          value={config.payload_field}
                          onChange={(e) => updateFieldMappingValue(sendgridField, 'payload_field', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={config.is_custom}
                          onCheckedChange={(checked) => updateFieldMappingValue(sendgridField, 'is_custom', checked)}
                          disabled={['email', 'cc', 'bcc'].includes(sendgridField)}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFieldMapping(sendgridField)}
                        disabled={['email', 'cc', 'bcc'].includes(sendgridField)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>Standard SendGrid fields:</strong> first_name, last_name, phone_number, city, state_province_region, postal_code, country, address_line_1, address_line_2</p>
                  <p><strong>Custom fields:</strong> Check the "Custom" box for SendGrid custom field IDs (e.g., e3_T, e4_T, e5_T, e13_T, e17_N)</p>
                </div>
              </div>

              {formData.mode === 'add_contact' && sendgridLists.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="list">SendGrid List</Label>
                  <Select
                    value={formData.sendgrid_list_id}
                    onValueChange={(value) => setFormData({ ...formData, sendgrid_list_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      {sendgridLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.mode === 'send_email' && sendgridTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="template">SendGrid Template</Label>
                  <Select
                    value={formData.sendgrid_template_id}
                    onValueChange={(value) => {
                      setFormData({ ...formData, sendgrid_template_id: value });
                      fetchTemplateKeys(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {sendgridTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.mode === 'send_email' && templateKeys.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Template Keys Available</Label>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex flex-wrap gap-2">
                      {templateKeys.map((key) => (
                        <span
                          key={key}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-mono"
                          title={`Use {{${key}}} to reference this field from webhook payload`}
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      These keys are used in the template. Reference them in fields below using {`{{key_name}}`} syntax.
                    </p>
                  </div>
                </div>
              )}

              {formData.mode === 'send_email' && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Email Configuration</h4>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mb-1">📧 Recipient Information</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Recipients (to, cc, bcc) are provided in the webhook payload using <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">mailto</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">cc</code>, and <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">bcc</code> fields.
                      These can be single emails or comma-separated lists.
                    </p>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Use {`{{field_name}}`} to pull values from webhook payload, or enter static values
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email_from">From Address</Label>
                      <Input
                        id="email_from"
                        placeholder="e.g., noreply@example.com or {{sender}}"
                        value={formData.email_from}
                        onChange={(e) => setFormData({ ...formData, email_from: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_from_name">From Name (optional)</Label>
                      <Input
                        id="email_from_name"
                        placeholder="e.g., Support Team or {{company}}"
                        value={formData.email_from_name}
                        onChange={(e) => setFormData({ ...formData, email_from_name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" data-testid="submit-webhook-btn">
                {editingEndpoint ? 'Update Endpoint' : 'Create Endpoint'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {endpoints.length > 0 ? (
          <>
            {/* Add Contact Group */}
            {endpoints.filter(e => e.mode === 'add_contact').length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={() => toggleGroup('add_contact')}
                  className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Plus className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">Add Contact Webhooks</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {endpoints.filter(e => e.mode === 'add_contact').length} webhook{endpoints.filter(e => e.mode === 'add_contact').length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {collapsedGroups.add_contact ? (
                    <ChevronDown className="h-6 w-6 text-green-600 dark:text-green-300" />
                  ) : (
                    <ChevronUp className="h-6 w-6 text-green-600 dark:text-green-300" />
                  )}
                </button>
                
                {!collapsedGroups.add_contact && (
                  <div className="grid grid-cols-1 gap-4 pl-4">
                    {endpoints.filter(e => e.mode === 'add_contact').map((endpoint) => {
                      const normalizedMapping = normalizeFieldMapping(endpoint.field_mapping || {});
                      return (
                        <Card key={endpoint.id} className="glass card-hover" data-testid="webhook-endpoint-card">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <CardTitle className="text-xl">{endpoint.name}</CardTitle>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          endpoint.mode === 'add_contact' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {endpoint.mode === 'add_contact' ? 'Add Contact' : 'Send Email'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCollapse(endpoint.id)}
                        data-testid="toggle-collapse-btn"
                      >
                        {collapsedCards[endpoint.id] === false ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(endpoint)}
                        data-testid="duplicate-endpoint-btn"
                        title="Duplicate Endpoint"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(endpoint)}
                        data-testid="edit-endpoint-btn"
                        title="Edit Endpoint"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateToken(endpoint.id)}
                        data-testid="regenerate-token-btn"
                        title="Regenerate Token"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(endpoint.id)}
                        data-testid="delete-webhook-btn"
                        title="Delete Endpoint"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {collapsedCards[endpoint.id] === false && (
                  <CardContent className="space-y-4">
                    {/* Full Webhook URL */}
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400 mb-1">Webhook URL</Label>
                      <div className="flex items-center space-x-2">
                        <code className="code-display flex-1 text-sm font-mono" data-testid="webhook-full-url">
                          {window.location.origin}/api/hooks/{endpoint.path}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`${window.location.origin}/api/hooks/${endpoint.path}`)}
                          data-testid="copy-url-btn"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Secret Token */}
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400 mb-1">Secret Token</Label>
                      <div className="flex items-center space-x-2">
                        <code className="code-display flex-1 text-sm font-mono" data-testid="webhook-secret-token">
                          {endpoint.secret_token}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(endpoint.secret_token)}
                          data-testid="copy-token-btn"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Field Mapping Display */}
                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2">Field Mappings</Label>
                      <div className="space-y-1">
                        {Object.entries(normalizedMapping).map(([sendgridField, config]) => (
                          <div key={sendgridField} className="flex items-center text-xs">
                            <code className="code-display px-2 py-1">{config.payload_field}</code>
                            <span className="mx-2 text-gray-400">→</span>
                            <code className="code-display px-2 py-1">{sendgridField}</code>
                            {config.is_custom && (
                              <span className="ml-2 badge badge-warning text-xs">Custom</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {endpoint.mode === 'add_contact' && endpoint.sendgrid_list_id && (
                      <div>
                        <Label className="text-sm text-gray-600 dark:text-gray-400">SendGrid List ID</Label>
                        <div className="mt-1">
                          <code className="code-display text-xs">{endpoint.sendgrid_list_id}</code>
                        </div>
                      </div>
                    )}

                    {endpoint.mode === 'send_email' && endpoint.sendgrid_template_id && (
                      <div>
                        <Label className="text-sm text-gray-600 dark:text-gray-400">SendGrid Template ID</Label>
                        <div className="mt-1">
                          <code className="code-display text-xs">{endpoint.sendgrid_template_id}</code>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm text-gray-600 dark:text-gray-400">Example cURL</Label>
                      <code className="code-display block mt-1 text-xs" data-testid="webhook-curl-example">
                        curl -X POST {window.location.origin}/api/hooks/{endpoint.path} \
                        <br />
                        &nbsp;&nbsp;-H "X-Webhook-Token: {endpoint.secret_token}" \
                        <br />
                        &nbsp;&nbsp;-H "Content-Type: application/json" \
                        <br />
                        &nbsp;&nbsp;-d '{'{'}"email":"user@example.com"{'}'}'
                      </code>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
                  </div>
                )}
              </div>
            )}

            {/* Send Email Group */}
            {endpoints.filter(e => e.mode === 'send_email').length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={() => toggleGroup('send_email')}
                  className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Mail className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Send Email Webhooks</h3>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        {endpoints.filter(e => e.mode === 'send_email').length} webhook{endpoints.filter(e => e.mode === 'send_email').length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {collapsedGroups.send_email ? (
                    <ChevronDown className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                  ) : (
                    <ChevronUp className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                  )}
                </button>
                
                {!collapsedGroups.send_email && (
                  <div className="grid grid-cols-1 gap-4 pl-4">
                    {endpoints.filter(e => e.mode === 'send_email').map((endpoint) => {
                      const normalizedMapping = normalizeFieldMapping(endpoint.field_mapping || {});
                      return (
                        <Card key={endpoint.id} className="glass card-hover" data-testid="webhook-endpoint-card">
                          <CardHeader>
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <CardTitle className="text-xl">{endpoint.name}</CardTitle>
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    endpoint.mode === 'add_contact' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                  }`}>
                                    {endpoint.mode === 'add_contact' ? 'Add Contact' : 'Send Email'}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCollapse(endpoint.id)}
                                  data-testid="toggle-collapse-btn"
                                >
                                  {collapsedCards[endpoint.id] === false ? (
                                    <ChevronUp className="h-5 w-5" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDuplicate(endpoint)}
                                  data-testid="duplicate-endpoint-btn"
                                  title="Duplicate Endpoint"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(endpoint)}
                                  data-testid="edit-endpoint-btn"
                                  title="Edit Endpoint"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRegenerateToken(endpoint.id)}
                                  data-testid="regenerate-token-btn"
                                  title="Regenerate Token"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(endpoint.id)}
                                  data-testid="delete-webhook-btn"
                                  title="Delete Endpoint"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          {collapsedCards[endpoint.id] === false && (
                            <CardContent className="space-y-4">
                              {/* Full Webhook URL */}
                              <div>
                                <Label className="text-sm text-gray-600 dark:text-gray-400 mb-1">Webhook URL</Label>
                                <div className="flex items-center space-x-2">
                                  <code className="code-display flex-1 text-sm font-mono" data-testid="webhook-full-url">
                                    {window.location.origin}/api/hooks/{endpoint.path}
                                  </code>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(`${window.location.origin}/api/hooks/${endpoint.path}`)}
                                    data-testid="copy-url-btn"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Secret Token */}
                              <div>
                                <Label className="text-sm text-gray-600 dark:text-gray-400 mb-1">Secret Token</Label>
                                <div className="flex items-center space-x-2">
                                  <code className="code-display flex-1 text-sm font-mono" data-testid="webhook-secret-token">
                                    {endpoint.secret_token}
                                  </code>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(endpoint.secret_token)}
                                    data-testid="copy-token-btn"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Field Mapping Display */}
                              <div>
                                <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2">Field Mappings</Label>
                                <div className="space-y-1">
                                  {Object.entries(normalizedMapping).map(([sendgridField, config]) => (
                                    <div key={sendgridField} className="flex items-center text-xs">
                                      <code className="code-display px-2 py-1">{config.payload_field}</code>
                                      <span className="mx-2 text-gray-400">→</span>
                                      <code className="code-display px-2 py-1">{sendgridField}</code>
                                      {config.is_custom && (
                                        <span className="ml-2 badge badge-warning text-xs">Custom</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {endpoint.mode === 'add_contact' && endpoint.sendgrid_list_id && (
                                <div>
                                  <Label className="text-sm text-gray-600 dark:text-gray-400">SendGrid List ID</Label>
                                  <div className="mt-1">
                                    <code className="code-display text-xs">{endpoint.sendgrid_list_id}</code>
                                  </div>
                                </div>
                              )}

                              {endpoint.mode === 'send_email' && endpoint.sendgrid_template_id && (
                                <div>
                                  <Label className="text-sm text-gray-600 dark:text-gray-400">SendGrid Template ID</Label>
                                  <div className="mt-1">
                                    <code className="code-display text-xs">{endpoint.sendgrid_template_id}</code>
                                  </div>
                                </div>
                              )}

                              <div>
                                <Label className="text-sm text-gray-600 dark:text-gray-400">Example cURL</Label>
                                <code className="code-display block mt-1 text-xs" data-testid="webhook-curl-example">
                                  curl -X POST {window.location.origin}/api/hooks/{endpoint.path} \
                                  <br />
                                  &nbsp;&nbsp;-H "X-Webhook-Token: {endpoint.secret_token}" \
                                  <br />
                                  &nbsp;&nbsp;-H "Content-Type: application/json" \
                                  <br />
                                  &nbsp;&nbsp;-d '{'{'}\"email\":\"user@example.com\"{'}'}\'
                                </code>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <Card className="glass">
            <CardContent className="text-center py-12">
              <p className="text-gray-500 mb-4">No webhook endpoints created yet</p>
              <Button onClick={() => setDialogOpen(true)}>Create Your First Endpoint</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Webhooks;