#!/bin/bash
echo "🚀 Deploy NAS Backup System"

# Dependencias sistema
sudo apt update
sudo apt install -y python3-pip python3-venv nginx mariadb-server rsync nmap mdadm

# Directorios NAS
sudo mkdir -p /nas/{backups,raid,uploads}
sudo chown -R www-data:www-data /nas
sudo chmod -R 755 /nas

# Virtualenv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Base de datos
sudo mysql -u root -p12345 << EOF
CREATE DATABASE IF NOT EXISTS backup_system;
EOF

# Migraciones
flask db upgrade

# Nginx
sudo tee /etc/nginx/sites-available/nas > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/nas /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Systemd
sudo cp nas.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable nas.service
sudo systemctl start nas.service

echo "✅ Deploy completado!"
echo "🌐 Accede: http://$(hostname -I | awk '{print $1}')"
echo "👤 Admin: admin / admin123"