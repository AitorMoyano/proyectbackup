import os, socket
from dotenv import load_dotenv
load_dotenv()

def _server_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def _network_range(ip):
    parts = ip.split('.')
    return f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"

_ip = os.environ.get('SERVER_IP') or _server_ip()

class Config:
    SECRET_KEY              = os.environ.get('SECRET_KEY') or 'dev-nas-secret-change-me'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///nas.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    BACKUP_DIR    = os.environ.get('BACKUP_DIR')    or '/srv/nas/backups'
    SHARES_DIR    = os.environ.get('SHARES_DIR')    or '/srv/nas/shares'
    SERVER_IP     = _ip
    NETWORK_RANGE = os.environ.get('NETWORK_RANGE') or _network_range(_ip)
