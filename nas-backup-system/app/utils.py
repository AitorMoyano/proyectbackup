import subprocess, os, socket
from datetime import datetime

def run_cmd(cmd, timeout=120):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return {'success': r.returncode == 0, 'output': r.stdout, 'error': r.stderr}
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'Tiempo de espera agotado', 'output': ''}
    except Exception as e:
        return {'success': False, 'error': str(e), 'output': ''}

def get_server_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def get_network_clients(network_range):
    clients = []
    r = run_cmd(f"sudo nmap -sn --host-timeout 2s {network_range}", timeout=60)
    if r['success']:
        lines = r['output'].split('\n')
        for i, line in enumerate(lines):
            if 'Nmap scan report' in line:
                ip = line.split()[-1].strip('()')
                name = f"Cliente-{ip.split('.')[-1]}"
                clients.append({'ip': ip, 'name': name})
    return clients

def get_disks():
    r = run_cmd("lsblk -dno NAME,SIZE,TYPE | grep disk")
    disks = []
    if r['success']:
        for line in r['output'].split('\n'):
            parts = line.split()
            if len(parts) >= 2:
                disks.append({'name': f'/dev/{parts[0]}', 'size': parts[1]})
    return disks

def get_folder_size(path):
    total = 0
    try:
        for dp, dn, fns in os.walk(path):
            for f in fns:
                try: total += os.path.getsize(os.path.join(dp, f))
                except: pass
    except: pass
    return total

def format_bytes(b):
    for unit in ['B','KB','MB','GB','TB']:
        if b < 1024: return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} PB"

def rebuild_samba(shares, server_ip):
    """Write /etc/samba/smb.conf and reload smbd"""
    lines = [
        '[global]',
        '   workgroup = WORKGROUP',
        f'   server string = NAS Server ({server_ip})',
        '   netbios name = NASSERVER',
        '   security = user',
        '   map to guest = Bad User',
        '   log level = 1',
        '   max log size = 1000',
        '',
    ]
    for s in shares:
        lines += [
            f'[{s.name}]',
            f'   path = {s.path}',
            f'   comment = {s.description or s.name}',
            '   browseable = yes',
            f'   read only = {"yes" if s.read_only else "no"}',
            f'   guest ok = {"yes" if s.is_public else "no"}',
            '   create mask = 0664',
            '   directory mask = 0775',
            '   force create mode = 0664',
            '   force directory mode = 0775',
            '',
        ]
    config = '\n'.join(lines)
    try:
        with open('/tmp/nas_smb.conf', 'w') as f:
            f.write(config)
        run_cmd('sudo cp /tmp/nas_smb.conf /etc/samba/smb.conf')
        run_cmd('sudo systemctl reload smbd || sudo systemctl restart smbd')
    except Exception:
        pass
