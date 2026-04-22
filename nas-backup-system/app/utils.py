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