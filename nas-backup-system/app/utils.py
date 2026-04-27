import subprocess
import os
import psutil
import shutil
from datetime import datetime

def run_command(cmd):
    """Ejecuta comando con sudo y retorna resultado"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
        return {'success': result.returncode == 0, 'output': result.stdout, 'error': result.stderr}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_network_clients():
    """Obtiene clientes en la red"""
    clients = []
    network = os.environ.get('NETWORK_RANGE', '192.168.56.0/24')
    result = run_command(f"sudo nmap -sn {network} | grep 'Nmap scan report' -A 2")
    if result['success']:
        # Parsear resultado nmap (simplificado)
        lines = result['output'].split('\n')
        for line in lines:
            if 'Nmap scan report' in line:
                ip = line.split()[-1]
                clients.append({'ip': ip, 'name': f'Cliente-{ip.split(".")[-1]}'})
    return clients

def get_disks():
    """Obtiene discos disponibles"""
    result = run_command("lsblk -dno NAME,SIZE,TYPE | grep disk")
    disks = []
    if result['success']:
        for line in result['output'].split('\n'):
            if line.strip():
                parts = line.split()
                disks.append({'name': f'/dev/{parts[0]}', 'size': parts[1]})
    return disks

def get_folder_size(path):
    """Calcula tamaño de carpeta"""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                total += os.path.getsize(fp)
    except:
        pass
    return total

def update_samba_config():
    """Regenera /etc/samba/smb.conf con los recursos compartidos de la BD"""
    try:
        from app.models import Share
        import flask
        app = flask.current_app._get_current_object()
        with app.app_context():
            shares = Share.query.all()
    except Exception:
        shares = []

    lines = [
        "[global]",
        "   workgroup = WORKGROUP",
        "   server string = NAS Backup Server",
        "   netbios name = NASSERVER",
        "   security = user",
        "   map to guest = Bad User",
        "   dns proxy = no",
        "",
    ]
    for s in shares:
        lines += [
            f"[{s.name}]",
            f"   path = {s.path}",
            f"   comment = {s.description or s.name}",
            f"   browseable = yes",
            f"   read only = {'yes' if s.read_only else 'no'}",
            f"   guest ok = {'yes' if s.is_public else 'no'}",
            f"   create mask = 0664",
            f"   directory mask = 0775",
            "",
        ]
    config = "\n".join(lines)
    try:
        with open('/tmp/smb_nas.conf', 'w') as f:
            f.write(config)
        run_command("sudo cp /tmp/smb_nas.conf /etc/samba/smb.conf")
        run_command("sudo systemctl reload smbd 2>/dev/null || sudo systemctl restart smbd 2>/dev/null")
    except Exception:
        pass