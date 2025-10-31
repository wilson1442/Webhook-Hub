import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json
import zipfile
import io
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

class BackupScheduler:
    def __init__(self, mongo_url, db_name, backup_dir="/opt/webhook-gateway/backups"):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.scheduler = AsyncIOScheduler()
        self.client = None
        self.db = None
        
    async def initialize(self):
        """Initialize MongoDB connection"""
        self.client = AsyncIOMotorClient(self.mongo_url)
        self.db = self.client[self.db_name]
        
    async def create_backup(self):
        """Create a backup of the database"""
        try:
            logger.info("Starting scheduled backup...")
            
            # Fetch data from collections
            backup_data = {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "users": await self.db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000),
                "webhook_endpoints": await self.db.webhook_endpoints.find({}, {"_id": 0}).to_list(1000),
                "webhook_logs": await self.db.webhook_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(1000).to_list(1000),
                "api_keys": []
            }
            
            # Create backup filename with timestamp
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"backup_{timestamp}.zip"
            filepath = self.backup_dir / filename
            
            # Create ZIP file
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                zip_file.writestr('backup.json', json.dumps(backup_data, indent=2, default=str))
            
            # Write to file
            with open(filepath, 'wb') as f:
                f.write(zip_buffer.getvalue())
            
            # Save backup record
            backup_record = {
                "filename": filename,
                "filepath": str(filepath),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "size_bytes": filepath.stat().st_size
            }
            await self.db.scheduled_backups.insert_one(backup_record)
            
            logger.info(f"Backup created successfully: {filename}")
            
            # Clean up old backups based on retention
            await self.cleanup_old_backups()
            
        except Exception as e:
            logger.error(f"Backup failed: {str(e)}")
    
    async def cleanup_old_backups(self):
        """Remove old backups based on retention settings"""
        try:
            # Get retention settings
            settings = await self.db.backup_settings.find_one({"_id": "backup_config"})
            if not settings:
                return
            
            retention = settings.get("retention", 7)
            
            # Get all backups sorted by date
            backups = await self.db.scheduled_backups.find().sort("created_at", -1).to_list(1000)
            
            # Delete old backups beyond retention
            if len(backups) > retention:
                for backup in backups[retention:]:
                    try:
                        # Delete file
                        filepath = Path(backup["filepath"])
                        if filepath.exists():
                            filepath.unlink()
                        
                        # Delete record
                        await self.db.scheduled_backups.delete_one({"_id": backup["_id"]})
                        logger.info(f"Deleted old backup: {backup['filename']}")
                    except Exception as e:
                        logger.error(f"Failed to delete backup {backup['filename']}: {e}")
        
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
    
    async def update_schedule(self, frequency, retention):
        """Update backup schedule"""
        try:
            # Remove existing job
            if self.scheduler.get_job('backup_job'):
                self.scheduler.remove_job('backup_job')
            
            # Add new job based on frequency
            if frequency == 'daily':
                trigger = CronTrigger(hour=2, minute=0)  # 2 AM daily
            elif frequency == 'weekly':
                trigger = CronTrigger(day_of_week='mon', hour=2, minute=0)  # Monday 2 AM
            else:
                logger.warning(f"Invalid frequency: {frequency}")
                return
            
            self.scheduler.add_job(
                self.create_backup,
                trigger=trigger,
                id='backup_job',
                replace_existing=True
            )
            
            # Save settings
            await self.db.backup_settings.update_one(
                {"_id": "backup_config"},
                {"$set": {
                    "frequency": frequency,
                    "retention": retention,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
            
            logger.info(f"Backup schedule updated: {frequency}, retention: {retention}")
            
        except Exception as e:
            logger.error(f"Failed to update schedule: {str(e)}")
    
    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Backup scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Backup scheduler stopped")
