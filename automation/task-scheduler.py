#!/usr/bin/env python3
"""
Task Scheduler for Android Server
Schedule and automate tasks on Android server
"""

import json
import time
import schedule
import subprocess
from datetime import datetime
from pathlib import Path

class TaskScheduler:
    def __init__(self, config_file="tasks.json"):
        self.config_file = Path(config_file)
        self.tasks = self.load_tasks()
        
    def load_tasks(self):
        """Load tasks from config file"""
        if self.config_file.exists():
            with open(self.config_file, 'r') as f:
                return json.load(f)
        return []
    
    def save_tasks(self):
        """Save tasks to config file"""
        with open(self.config_file, 'w') as f:
            json.dump(self.tasks, f, indent=2)
    
    def add_task(self, name, command, schedule_type, schedule_time):
        """Add a new scheduled task"""
        task = {
            "name": name,
            "command": command,
            "schedule_type": schedule_type,
            "schedule_time": schedule_time,
            "enabled": True,
            "last_run": None
        }
        self.tasks.append(task)
        self.save_tasks()
        self.schedule_task(task)
        
    def schedule_task(self, task):
        """Schedule a task based on its config"""
        def job():
            print(f"[{datetime.now()}] Running task: {task['name']}")
            try:
                result = subprocess.run(
                    task['command'],
                    shell=True,
                    capture_output=True,
                    text=True
                )
                print(f"Output: {result.stdout}")
                if result.stderr:
                    print(f"Error: {result.stderr}")
                task['last_run'] = datetime.now().isoformat()
                self.save_tasks()
            except Exception as e:
                print(f"Error running task {task['name']}: {e}")
        
        schedule_type = task['schedule_type']
        schedule_time = task['schedule_time']
        
        if schedule_type == "interval":
            schedule.every(int(schedule_time)).minutes.do(job)
        elif schedule_type == "hourly":
            schedule.every().hour.at(f":{schedule_time}").do(job)
        elif schedule_type == "daily":
            schedule.every().day.at(schedule_time).do(job)
        elif schedule_type == "weekly":
            day, time_str = schedule_time.split()
            getattr(schedule.every(), day.lower()).at(time_str).do(job)
    
    def run(self):
        """Run the scheduler"""
        print("Task Scheduler started...")
        
        # Schedule all enabled tasks
        for task in self.tasks:
            if task.get('enabled', True):
                self.schedule_task(task)
                print(f"Scheduled: {task['name']}")
        
        # Run scheduler loop
        while True:
            schedule.run_pending()
            time.sleep(1)

# Example tasks configuration
EXAMPLE_TASKS = [
    {
        "name": "System Backup",
        "command": "tar -czf ~/server/backups/backup_$(date +%Y%m%d).tar.gz ~/server/data",
        "schedule_type": "daily",
        "schedule_time": "02:00"
    },
    {
        "name": "Clear Temp Files",
        "command": "rm -rf ~/server/temp/*",
        "schedule_type": "daily",
        "schedule_time": "03:00"
    },
    {
        "name": "Check Disk Space",
        "command": "df -h ~/server",
        "schedule_type": "interval",
        "schedule_time": "60"
    },
    {
        "name": "Update Packages",
        "command": "pkg update && pkg upgrade -y",
        "schedule_type": "weekly",
        "schedule_time": "sunday 04:00"
    }
]

if __name__ == "__main__":
    scheduler = TaskScheduler()
    
    # Create example tasks file if not exists
    if not Path("tasks.json").exists():
        with open("tasks.json", 'w') as f:
            json.dump(EXAMPLE_TASKS, f, indent=2)
        print("Created example tasks.json")
    
    try:
        scheduler.run()
    except KeyboardInterrupt:
        print("\nScheduler stopped")
