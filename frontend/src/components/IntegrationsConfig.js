import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Bell, MessageSquare, Send, Zap, Server, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { API } from '../App';

const IntegrationsConfig = () => {
  const [ntfyConfig, setNtfyConfig] = useState({ topic_url: '', auth_token: '' });
  const [discordConfig, setDiscordConfig] = useState({ webhook_url: '' });
  const [slackConfig, setSlackConfig] = useState({ webhook_url: '' });
  const [telegramConfig, setTelegramConfig] = useState({ bot_token: '', chat_id: '' });
  const [syslogConfig, setSyslogConfig] = useState({ host: '', port: 514, protocol: 'udp', enabled: true });
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState({});

  const saveIntegration = async (service, config) => {
    setSaving({ ...saving, [service]: true });
    try {
      await axios.post(`${API}/settings/api-keys`, {
        service_name: service,
        credentials: config
      });
      toast.success(`${service} configuration saved successfully`);
    } catch (error) {
      toast.error(`Failed to save ${service} configuration`);
    } finally {
      setSaving({ ...saving, [service]: false });
    }
  };

  const saveSyslog = async () => {
    setSaving({ ...saving, syslog: true });
    try {
      await axios.post(`${API}/syslog/config`, syslogConfig);
      toast.success('Syslog configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save syslog configuration');
    } finally {
      setSaving({ ...saving, syslog: false });
    }
  };

  const testSyslog = async () => {
    setTesting({ ...testing, syslog: true });
    try {
      const response = await axios.post(`${API}/syslog/test`, syslogConfig);
      if (response.data.status === 'success') {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Syslog test failed');
    } finally {
      setTesting({ ...testing, syslog: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Syslog Configuration */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-blue-600" />
            <CardTitle>Syslog Server</CardTitle>
          </div>
          <CardDescription>
            Forward all webhook logs to a remote syslog server (RFC 5424)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="syslog-host">Syslog Server Host</Label>
              <Input
                id="syslog-host"
                placeholder="syslog.example.com"
                value={syslogConfig.host}
                onChange={(e) => setSyslogConfig({ ...syslogConfig, host: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="syslog-port">Port</Label>
              <Input
                id="syslog-port"
                type="number"
                placeholder="514"
                value={syslogConfig.port}
                onChange={(e) => setSyslogConfig({ ...syslogConfig, port: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="syslog-protocol">Protocol</Label>
            <Select value={syslogConfig.protocol} onValueChange={(val) => setSyslogConfig({ ...syslogConfig, protocol: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="udp">UDP (Standard)</SelectItem>
                <SelectItem value="tcp">TCP (Reliable)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button onClick={testSyslog} variant="outline" disabled={testing.syslog}>
              {testing.syslog ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button onClick={saveSyslog} disabled={saving.syslog}>
              {saving.syslog ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ntfy.sh */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-orange-600" />
            <CardTitle>Ntfy.sh</CardTitle>
          </div>
          <CardDescription>
            Simple push notifications. Send to topics like https://ntfy.sh/your-topic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ntfy-topic">Topic URL</Label>
            <Input
              id="ntfy-topic"
              placeholder="https://ntfy.sh/your-webhook-topic"
              value={ntfyConfig.topic_url}
              onChange={(e) => setNtfyConfig({ ...ntfyConfig, topic_url: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Create a unique topic name at ntfy.sh</p>
          </div>
          <div>
            <Label htmlFor="ntfy-token">Auth Token (Optional)</Label>
            <Input
              id="ntfy-token"
              type="password"
              placeholder="Bearer token for protected topics"
              value={ntfyConfig.auth_token}
              onChange={(e) => setNtfyConfig({ ...ntfyConfig, auth_token: e.target.value })}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded text-sm">
            <strong>How to use:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Pick a unique topic name (e.g., my-company-webhooks)</li>
              <li>Your topic URL: https://ntfy.sh/my-company-webhooks</li>
              <li>Subscribe to notifications via ntfy mobile app or web</li>
              <li>Webhook payload should include: title, message, tags, priority</li>
            </ol>
          </div>
          <Button onClick={() => saveIntegration('ntfy', ntfyConfig)} disabled={saving.ntfy}>
            {saving.ntfy ? 'Saving...' : 'Save Ntfy Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Discord */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <CardTitle>Discord</CardTitle>
          </div>
          <CardDescription>
            Send messages to Discord channels via webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="discord-webhook">Webhook URL</Label>
            <Input
              id="discord-webhook"
              type="password"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordConfig.webhook_url}
              onChange={(e) => setDiscordConfig({ webhook_url: e.target.value })}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded text-sm">
            <strong>How to get webhook URL:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Go to your Discord server</li>
              <li>Edit channel → Integrations → Webhooks</li>
              <li>Create webhook and copy the URL</li>
              <li>Webhook payload should include: content (text) or embeds</li>
            </ol>
          </div>
          <Button onClick={() => saveIntegration('discord', discordConfig)} disabled={saving.discord}>
            {saving.discord ? 'Saving...' : 'Save Discord Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Slack */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-600" />
            <CardTitle>Slack</CardTitle>
          </div>
          <CardDescription>
            Send messages to Slack channels via incoming webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <Input
              id="slack-webhook"
              type="password"
              placeholder="https://hooks.slack.com/services/..."
              value={slackConfig.webhook_url}
              onChange={(e) => setSlackConfig({ webhook_url: e.target.value })}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded text-sm">
            <strong>How to get webhook URL:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Go to api.slack.com/apps</li>
              <li>Create new app → Incoming Webhooks</li>
              <li>Activate and add to channel</li>
              <li>Copy the webhook URL</li>
              <li>Webhook payload should include: text (message) or blocks</li>
            </ol>
          </div>
          <Button onClick={() => saveIntegration('slack', slackConfig)} disabled={saving.slack}>
            {saving.slack ? 'Saving...' : 'Save Slack Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Send className="h-5 w-5 text-blue-600" />
            <CardTitle>Telegram</CardTitle>
          </div>
          <CardDescription>
            Send messages via Telegram Bot API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={telegramConfig.bot_token}
              onChange={(e) => setTelegramConfig({ ...telegramConfig, bot_token: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="telegram-chat">Chat ID</Label>
            <Input
              id="telegram-chat"
              placeholder="-1001234567890"
              value={telegramConfig.chat_id}
              onChange={(e) => setTelegramConfig({ ...telegramConfig, chat_id: e.target.value })}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded text-sm">
            <strong>Setup instructions:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Chat with @BotFather on Telegram</li>
              <li>Send /newbot and follow instructions</li>
              <li>Copy the bot token</li>
              <li>Add bot to your channel/group</li>
              <li>Get chat ID: Forward message to @userinfobot</li>
              <li>Webhook payload should include: text (message)</li>
            </ol>
          </div>
          <Button onClick={() => saveIntegration('telegram', telegramConfig)} disabled={saving.telegram}>
            {saving.telegram ? 'Saving...' : 'Save Telegram Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsConfig;