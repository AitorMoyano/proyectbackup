import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-nas-backup-2024-supersecret'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'mysql+pymysql://root:12345@localhost/backup_system'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    BACKUP_DIR = os.environ.get('BACKUP_DIR') or '/nas/backups'
    RAID_MOUNT = '/nas/raid'
    UPLOAD_FOLDER = '/nas/uploads'