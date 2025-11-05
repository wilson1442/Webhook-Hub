"""
Notification Integrations Module
Handles sending notifications to various services: Ntfy, Discord, Slack, Telegram
Also handles syslog forwarding
"""

import requests
import json
import logging
import socket
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Syslog functionality
class SyslogSender:
    """Send logs to remote syslog server using RFC 5424 format"""
    
    def __init__(self, host: str, port: int, protocol: str = 'udp'):
        self.host = host
        self.port = port
        self.protocol = protocol.lower()
        
    def send_log(self, log_data: Dict[str, Any]) -> bool:
        """Send webhook log to syslog server"""
        try:
            # Build RFC 5424 syslog message
            # Priority: Facility=16 (local0), Severity=6 (info) = 16*8 + 6 = 134
            priority = 134
            timestamp = datetime.now(timezone.utc).isoformat()
            hostname = socket.gethostname()
            app_name = "webhook-gateway"
            
            # Structured data with webhook log info
            log_json = json.dumps(log_data, default=str)
            
            # RFC 5424 format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
            syslog_message = (
                f"<{priority}>1 {timestamp} {hostname} {app_name} - - - {log_json}\n"
            )
            
            if self.protocol == 'tcp':
                return self._send_tcp(syslog_message)
            else:
                return self._send_udp(syslog_message)
                
        except Exception as e:
            logger.error(f"Error sending to syslog: {e}")
            return False
    
    def _send_udp(self, message: str) -> bool:
        """Send via UDP"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.sendto(message.encode('utf-8'), (self.host, self.port))
            sock.close()
            return True
        except Exception as e:
            logger.error(f"UDP syslog error: {e}")
            return False
    
    def _send_tcp(self, message: str) -> bool:
        """Send via TCP"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((self.host, self.port))
            sock.send(message.encode('utf-8'))
            sock.close()
            return True
        except Exception as e:
            logger.error(f"TCP syslog error: {e}")
            return False
    
    def test_connection(self) -> bool:
        """Test connection to syslog server"""
        test_message = f"<134>1 {datetime.now(timezone.utc).isoformat()} test webhook-gateway - - - TEST\n"
        if self.protocol == 'tcp':
            return self._send_tcp(test_message)
        else:
            return self._send_udp(test_message)


# Ntfy.sh integration
def send_ntfy_notification(topic_url: str, title: str, message: str, auth_token: Optional[str] = None, 
                           tags: Optional[list] = None, priority: int = 3) -> Dict[str, Any]:
    """
    Send notification to Ntfy.sh topic
    
    Args:
        topic_url: Full Ntfy topic URL (e.g., https://ntfy.sh/my-topic)
        title: Notification title
        message: Notification message
        auth_token: Optional Bearer token for authentication
        tags: List of emoji tags (e.g., ['warning', 'skull'])
        priority: 1-5, default 3 (5 is highest)
    
    Returns:
        Dict with success status and message
    """
    try:
        headers = {'Content-Type': 'text/plain'}
        if title:
            headers['Title'] = title
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        if tags:
            headers['Tags'] = ','.join(tags)
        if priority:
            headers['Priority'] = str(priority)
        
        response = requests.post(topic_url, data=message, headers=headers, timeout=10)
        
        if response.status_code in [200, 201]:
            return {'success': True, 'message': 'Notification sent successfully'}
        else:
            return {'success': False, 'message': f'Ntfy error: {response.text}'}
            
    except Exception as e:
        logger.error(f"Ntfy notification error: {e}")
        return {'success': False, 'message': str(e)}


# Discord integration
def send_discord_message(webhook_url: str, content: str = None, embeds: list = None, 
                        username: str = None) -> Dict[str, Any]:
    """
    Send message to Discord via webhook
    
    Args:
        webhook_url: Discord webhook URL
        content: Plain text message
        embeds: List of Discord embed objects
        username: Override webhook username
    
    Returns:
        Dict with success status and message
    """
    try:
        payload = {}
        if content:
            payload['content'] = content
        if embeds:
            payload['embeds'] = embeds
        if username:
            payload['username'] = username
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        
        if response.status_code == 204:
            return {'success': True, 'message': 'Discord message sent'}
        else:
            return {'success': False, 'message': f'Discord error: {response.text}'}
            
    except Exception as e:
        logger.error(f"Discord webhook error: {e}")
        return {'success': False, 'message': str(e)}


# Slack integration
def send_slack_message(webhook_url: str, text: str = None, blocks: list = None, 
                      username: str = None, icon_emoji: str = None) -> Dict[str, Any]:
    """
    Send message to Slack via webhook
    
    Args:
        webhook_url: Slack incoming webhook URL
        text: Plain text message
        blocks: List of Slack block objects
        username: Override username
        icon_emoji: Custom emoji icon (e.g., ':ghost:')
    
    Returns:
        Dict with success status and message
    """
    try:
        payload = {}
        if text:
            payload['text'] = text
        if blocks:
            payload['blocks'] = blocks
        if username:
            payload['username'] = username
        if icon_emoji:
            payload['icon_emoji'] = icon_emoji
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            return {'success': True, 'message': 'Slack message sent'}
        else:
            return {'success': False, 'message': f'Slack error: {response.text}'}
            
    except Exception as e:
        logger.error(f"Slack webhook error: {e}")
        return {'success': False, 'message': str(e)}


# Telegram integration
def send_telegram_message(bot_token: str, chat_id: str, text: str, 
                         parse_mode: str = 'HTML') -> Dict[str, Any]:
    """
    Send message to Telegram via Bot API
    
    Args:
        bot_token: Telegram Bot API token
        chat_id: Target chat ID
        text: Message text
        parse_mode: 'HTML' or 'Markdown'
    
    Returns:
        Dict with success status and message
    """
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': text,
            'parse_mode': parse_mode
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 200:
            return {'success': True, 'message': 'Telegram message sent'}
        else:
            error_data = response.json()
            return {'success': False, 'message': f"Telegram error: {error_data.get('description', response.text)}"}
            
    except Exception as e:
        logger.error(f"Telegram API error: {e}")
        return {'success': False, 'message': str(e)}
