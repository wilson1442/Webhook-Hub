import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const NotConfigured = ({ service = 'SendGrid' }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md glass">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            <CardTitle>{service} Not Configured</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {service} integration is not configured or has been disabled. 
            Please configure the integration in Settings to use this feature.
          </p>
          <Button onClick={() => navigate('/settings')} className="w-full">
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotConfigured;
