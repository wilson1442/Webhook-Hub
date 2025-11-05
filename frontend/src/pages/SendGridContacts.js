import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Users, Search, Filter, Edit, RefreshCw, X, Plus } from 'lucide-react';
import NotConfigured from '../components/NotConfigured';

const SendGridContacts = () => {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [contacts, setContacts] = useState([]);
  const [allFields, setAllFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({});
  const [updating, setUpdating] = useState(false);
  const [sendgridConfigured, setSendgridConfigured] = useState(true);

  useEffect(() => {
    checkSendGridConfig();
  }, []);

  useEffect(() => {
    if (sendgridConfigured) {
      fetchLists();
      fetchFields();
    }
  }, [sendgridConfigured]);

  const checkSendGridConfig = async () => {
    try {
      const response = await axios.get(`${API}/settings/api-keys`);
      const sendgridKey = response.data.find(key => key.service_name === 'sendgrid');
      setSendgridConfigured(sendgridKey && sendgridKey.is_active !== false);
    } catch (error) {
      setSendgridConfigured(false);
    }
  };

  const fetchLists = async () => {
    try {
      const response = await axios.get(`${API}/sendgrid/lists`);
      setLists(response.data.lists || []);
    } catch (error) {
      toast.error('Failed to fetch lists');
    }
  };

  const fetchFields = async () => {
    try {
      const response = await axios.get(`${API}/sendgrid/fields`);
      const fields = response.data.fields || [];
      setAllFields(fields);
    } catch (error) {
      toast.error('Failed to fetch fields');
    }
  };

  const fetchContacts = async () => {
    if (!selectedList) {
      toast.error('Please select a list first');
      return;
    }

    setLoading(true);
    try {
      let url = `${API}/sendgrid/lists/${selectedList}/contacts`;
      
      // Add filters if any
      if (filters.length > 0) {
        const filterQuery = filters.map(f => `${f.field}=${f.operator}:${f.value}`).join('&');
        url += `?filters=${encodeURIComponent(filterQuery)}`;
      }

      const response = await axios.get(url);
      setContacts(response.data.contacts || []);
      toast.success(`Loaded ${response.data.contacts?.length || 0} contacts`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const updateFilter = (index, key, value) => {
    const newFilters = [...filters];
    newFilters[index][key] = value;
    setFilters(newFilters);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const toggleContactSelection = (contactId) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    } else {
      setSelectedContacts([...selectedContacts, contactId]);
    }
  };

  const toggleAllContacts = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const openBulkEdit = () => {
    if (selectedContacts.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }
    setBulkEditFields({});
    setBulkEditOpen(true);
  };

  const updateBulkEditField = (field, value) => {
    setBulkEditFields({
      ...bulkEditFields,
      [field]: value
    });
  };

  const handleBulkUpdate = async () => {
    if (Object.keys(bulkEditFields).length === 0) {
      toast.error('Please enter at least one field to update');
      return;
    }

    setUpdating(true);
    try {
      // Get email addresses for the selected contact IDs
      const selectedContactData = contacts.filter(c => selectedContacts.includes(c.id));
      const contactEmails = selectedContactData.map(c => c.email);
      
      const response = await axios.patch(`${API}/sendgrid/contacts/bulk-update`, {
        contact_emails: contactEmails,
        updates: bulkEditFields
      });
      
      toast.success(response.data.message || 'Contacts updated successfully');
      setBulkEditOpen(false);
      setSelectedContacts([]);
      fetchContacts(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update contacts');
    } finally {
      setUpdating(false);
    }
  };

  const getFieldValue = (contact, fieldName) => {
    // Check in custom_fields first
    if (contact.custom_fields && contact.custom_fields[fieldName] !== undefined) {
      return contact.custom_fields[fieldName];
    }
    // Then check in standard fields
    return contact[fieldName] || '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          SendGrid Contacts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View, filter, and bulk edit contacts in your SendGrid lists
        </p>
      </div>

      {/* List Selection and Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Select List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedList} onValueChange={setSelectedList}>
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select a list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name} ({list.contact_count || 0} contacts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={fetchContacts} disabled={!selectedList || loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Load Contacts
                </>
              )}
            </Button>

            {selectedContacts.length > 0 && (
              <Button onClick={openBulkEdit} variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Bulk Edit ({selectedContacts.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter Builder */}
      <Card className="glass">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filters</CardTitle>
            <Button onClick={addFilter} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Filter
            </Button>
          </div>
          <CardDescription>Filter contacts by any field</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filters.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No filters applied. Click "Add Filter" to start filtering.
            </p>
          ) : (
            filters.map((filter, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Select 
                  value={filter.field} 
                  onValueChange={(value) => updateFilter(index, 'field', value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {allFields.map((field) => (
                      <SelectItem key={field.field_name} value={field.field_name}>
                        {field.field_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select 
                  value={filter.operator} 
                  onValueChange={(value) => updateFilter(index, 'operator', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                    <SelectItem value="notEmpty">Not Empty</SelectItem>
                    <SelectItem value="empty">Empty</SelectItem>
                  </SelectContent>
                </Select>

                {!['empty', 'notEmpty'].includes(filter.operator) && (
                  <Input
                    value={filter.value}
                    onChange={(e) => updateFilter(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1"
                  />
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFilter(index)}
                  className="text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      {contacts.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Contacts ({contacts.length})
                {selectedContacts.length > 0 && (
                  <span className="text-sm font-normal text-blue-600 dark:text-blue-400 ml-2">
                    {selectedContacts.length} selected
                  </span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedContacts.length === contacts.length && contacts.length > 0}
                        onCheckedChange={toggleAllContacts}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      LoanOfficerName
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      LO Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      LO NMLS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      LO Phone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {contact.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {getFieldValue(contact, 'LoanOfficerName')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {getFieldValue(contact, 'LO EMAIL')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {getFieldValue(contact, 'LO NMLS')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {getFieldValue(contact, 'LO Phone')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Edit Contacts</DialogTitle>
            <DialogDescription>
              Update {selectedContacts.length} selected contact(s). Enter new values for the fields you want to update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Reserved Fields Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                📋 Reserved Fields ({allFields.filter(f => f.is_reserved).length})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {allFields.filter(field => field.is_reserved).map((field) => (
                  <div key={field.field_name} className="space-y-1.5">
                    <Label htmlFor={field.field_name} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {field.field_name}
                    </Label>
                    <Input
                      id={field.field_name}
                      value={bulkEditFields[field.field_name] || ''}
                      onChange={(e) => updateBulkEditField(field.field_name, e.target.value)}
                      placeholder="Leave empty to keep current"
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Fields Section */}
            <div>
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3 pb-2 border-b border-purple-200 dark:border-purple-800">
                ⚙️ Custom Fields ({allFields.filter(f => !f.is_reserved).length})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {allFields.filter(field => !field.is_reserved).map((field) => (
                  <div key={field.field_name} className="space-y-1.5">
                    <Label htmlFor={field.field_name} className="text-xs font-medium text-purple-700 dark:text-purple-400">
                      {field.field_name}
                    </Label>
                    <Input
                      id={field.field_name}
                      value={bulkEditFields[field.field_name] || ''}
                      onChange={(e) => updateBulkEditField(field.field_name, e.target.value)}
                      placeholder="Leave empty to keep current"
                      className="text-sm border-purple-200 dark:border-purple-800 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate} disabled={updating}>
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update {selectedContacts.length} Contact(s)
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SendGridContacts;
