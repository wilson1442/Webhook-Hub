import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { List, Users, Plus, RefreshCw, Mail } from 'lucide-react';
import NotConfigured from '../components/NotConfigured';

const SendGridLists = () => {
  const [lists, setLists] = useState([]);
  const [sendgridConfigured, setSendgridConfigured] = useState(true);
  useEffect(() => {
    checkSendGridConfig();
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
  const [filteredLists, setFilteredLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: ''
  });
    checkApiKey();
    fetchLists();
    // Filter lists based on search query
    if (searchQuery.trim() === '') {
      setFilteredLists(lists);
    } else {
      const filtered = lists.filter(list =>
        list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        list.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLists(filtered);
  }, [searchQuery, lists]);
  const checkApiKey = async () => {
      const sendgridKey = response.data.find(k => k.service_name === 'sendgrid');
      setHasApiKey(!!sendgridKey);
      setHasApiKey(false);
  const fetchLists = async () => {
      const response = await axios.get(`${API}/sendgrid/lists`);
      setLists(response.data.lists || []);
      setFilteredLists(response.data.lists || []);
      toast.error('Failed to fetch SendGrid lists');
    } finally {
      setLoading(false);
  const handleCreateList = async (e) => {
    e.preventDefault();
      const response = await axios.post(`${API}/sendgrid/lists/create`, formData);
      toast.success('List created successfully!');
      setDialogOpen(false);
      fetchLists();
      setFormData({ name: '' });
      toast.error(error.response?.data?.detail || 'Failed to create list');
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!hasApiKey) {
      <div className="space-y-8" data-testid="sendgrid-lists-page">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SendGrid Lists</h1>
          <p className="text-gray-600">Manage your SendGrid contact lists</p>
        </div>
        <Card className="glass">
          <CardContent className="text-center py-12">
            <div className="p-4 bg-blue-100 rounded-full inline-block mb-4">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">SendGrid Not Configured</h3>
            <p className="text-gray-600 mb-4">
              Add your SendGrid API key in Settings to view and manage lists
            </p>
            <Button onClick={() => window.location.href = '/settings'} data-testid="go-to-settings-btn">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
  if (!sendgridConfigured) {
    return <NotConfigured service="SendGrid" />;
  return (
    <div className="space-y-8" data-testid="sendgrid-lists-page">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <Input
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
            data-testid="search-lists-input"
          />
          <Button
            variant="outline"
            onClick={fetchLists}
            className="btn-transition"
            data-testid="refresh-lists-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-transition" data-testid="create-list-btn">
                <Plus className="h-4 w-4 mr-2" />
                Create List
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="create-list-dialog">
              <DialogHeader>
                <DialogTitle>Create SendGrid List</DialogTitle>
                <DialogDescription>
                  Create a new contact list in your SendGrid account
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateList} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">List Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Newsletter Subscribers"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="list-name-input"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="submit-list-btn">
                  Create List
                </Button>
              </form>
            </DialogContent>
          </Dialog>
      {filteredLists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists.map((list) => (
            <Card key={list.id} className="glass card-hover" data-testid="list-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full">
                      <List className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{list.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {list.contact_count || 0} contacts
                      </CardDescription>
                  </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p><strong>ID:</strong> <code className="text-xs bg-gray-100 px-2 py-1 rounded">{list.id}</code></p>
              </CardContent>
            </Card>
          ))}
      ) : (
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No lists found</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="create-first-list-btn">
              Create Your First List
      )}
    </div>
  );
};
export default SendGridLists;
