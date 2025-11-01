import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Rocket, Package, Bug, Sparkles, GitCommit } from 'lucide-react';

const ReleaseNotes = () => {
  const releases = [
    {
      version: '1.0.2',
      date: '2025-01-XX',
      type: 'minor',
      changes: [
        {
          category: 'Features',
          icon: Sparkles,
          items: [
            'Added delete button for individual log entries',
            'Added "Delete All Failed" button to remove all failed log entries at once',
            'Created dedicated Release Notes page showing version history',
            'Improved test page visibility with darker font colors for curl commands and email preview'
          ]
        },
        {
          category: 'Improvements',
          icon: Package,
          items: [
            'Enhanced mailto/cc/bcc field handling for send_email mode',
            'Fixed payload field defaulting to "mailto" for send_email webhooks',
            'Improved field mapping logic to prevent duplicate email fields in test payloads',
            'Better backwards compatibility for old webhooks with email field mappings'
          ]
        }
      ]
    },
    {
      version: '1.0.1',
      date: '2024-12-XX',
      type: 'minor',
      changes: [
        {
          category: 'Features',
          icon: Sparkles,
          items: [
            'Dynamic SendGrid field mapping with template key extraction',
            'Automated template key detection and display',
            'Test Webhooks page with auto-populated sample payloads',
            'SendGrid Fields management page with sync functionality',
            'Webhook duplication feature',
            'Logs refresh button with loading state',
            'Collapsible "SendGrid Data" menu in sidebar'
          ]
        },
        {
          category: 'Improvements',
          icon: Package,
          items: [
            'Webhooks grouped by mode with color-coded badges',
            'Webhook cards now collapsed by default',
            'Integration toggles in Settings page',
            'Renamed "API Keys" to "Integrations"',
            'Full payload storage in webhook logs'
          ]
        },
        {
          category: 'Bug Fixes',
          icon: Bug,
          items: [
            'Fixed MongoDB ObjectId serialization issues',
            'Fixed "unhashable type: dict" errors in payload processing',
            'GitHub release detection now works without authentication token',
            'Resolved backup download 500 errors'
          ]
        }
      ]
    },
    {
      version: '1.0.0',
      date: '2024-11-XX',
      type: 'major',
      changes: [
        {
          category: 'Initial Release',
          icon: Rocket,
          items: [
            'Core webhook gateway functionality',
            'SendGrid integration (Add to List, Send Email via Template)',
            'User authentication and management',
            'Webhook endpoint creation with secret tokens',
            'Comprehensive logging system',
            'CSV export for logs',
            'Settings management (API keys, backup, updates)',
            'Dashboard with statistics',
            'Dark mode support',
            'Automated backup scheduler (daily/weekly)',
            'Profile management with password change'
          ]
        }
      ]
    }
  ];

  const getVersionBadgeColor = (type) => {
    switch (type) {
      case 'major':
        return 'bg-red-500 text-white';
      case 'minor':
        return 'bg-blue-500 text-white';
      case 'patch':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">Release Notes</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track all the improvements, features, and fixes across versions
        </p>
      </div>

      <div className="space-y-6">
        {releases.map((release) => (
          <Card key={release.version} className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <GitCommit className="h-6 w-6 text-blue-500" />
                  <CardTitle className="text-2xl">Version {release.version}</CardTitle>
                  <Badge className={getVersionBadgeColor(release.type)}>
                    {release.type.toUpperCase()}
                  </Badge>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {release.date}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {release.changes.map((changeGroup, idx) => (
                <div key={idx}>
                  <div className="flex items-center space-x-2 mb-3">
                    <changeGroup.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {changeGroup.category}
                    </h3>
                  </div>
                  <ul className="space-y-2 ml-7">
                    {changeGroup.items.map((item, itemIdx) => (
                      <li
                        key={itemIdx}
                        className="text-gray-600 dark:text-gray-400 flex items-start"
                      >
                        <span className="text-blue-500 mr-2">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ReleaseNotes;
