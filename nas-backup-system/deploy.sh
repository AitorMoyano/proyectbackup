#!/bin/bash
set -e

echo "============================================"
echo "  NAS Backup System — Deploy"
echo "============================================"

INSTALL_DIR="/opt/nas-home"
APP_USER="www-data"

echo "[1/7] Instalando dependencias del sistema..."
sudo apt update -qq
sudo apt install -y python3 python3-pip python3-venv nginx mariadb-server \
                    rsync nmap mdadm lsblk net-tools sudo

echo "[2/7] Creando directorios NAS..."
sudo mkdir -p /nas/{backups,raid,uploads}
sudo chown -R $APP_USER:$APP_USER /nas
sudo chmod -R 755 /nas

echo "[3/7] Instalando la aplicación en $INSTALL_DIR..."
sudo mkdir -p $INSTALL_DIR
sudo cp -r . $INSTALL_DIR/
sudo chown -R $APP_USER:$APP_USER $INSTALL_DIR

echo "[4/7] Configurando entorno virtual Python..."
sudo -u $APP_USER python3 -m venv $INSTALL_DIR/venv
sudo -u $APP_USER $INSTALL_DIR/venv/bin/pip install --quiet --upgrade pip
sudo -u $APP_USER $INSTALL_DIR/venv/bin/pip install --quiet -r $INSTALL_DIR/requirements.txt

echo "[5/7] Configurando base de datos..."
sudo systemctl start mariadb
sudo systemctl enable mariadb

if [ ! -f "$INSTALL_DIR/.env" ]; then
    DB_PASS=$(openssl rand -base64 16 | tr -dc 'A-Za-z0-9' | head -c 20)
    SECRET_KEY=$(openssl rand -base64 32)
    sudo tee $INSTALL_DIR/.env > /dev/null <<EOF
SECRET_KEY=$SECRET_KEY
DATABASE_URL=mysql+pymysql://nas_user:${DB_PASS}@localhost/backup_system
EOF
    sudo chown $APP_USER:$APP_USER $INSTALL_DIR/.env
    sudo chmod 600 $INSTALL_DIR/.env
else
    DB_PASS=$(grep DATABASE_URL $INSTALL_DIR/.env | grep -oP '(?<=:)[^@]+(?=@)')
fi

sudo mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS backup_system CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS 'nas_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON backup_system.* TO 'nas_user'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "[6/7] Inicializando base de datos..."
cd $INSTALL_DIR
sudo -u $APP_USER bash -c "
    source venv/bin/activate
    export FLASK_APP=run.py
    if [ ! -d 'migrations' ]; then
        flask db init
        flask db migrate -m 'initial'
    fi
    flask db upgrade || python run.py & sleep 3 && kill %1 2>/dev/null || true
"

echo "[7/7] Configurando Nginx y Systemd..."
sudo tee /etc/nginx/sites-available/nas > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location /static/ {
        alias /opt/nas-home/app/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/nas /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

sudo tee /etc/systemd/system/nas.service > /dev/null <<EOF
[Unit]
Description=NAS Backup System
After=network.target mariadb.service
Requires=mariadb.service

[Service]
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
Environment="PATH=$INSTALL_DIR/venv/bin"
ExecStart=$INSTALL_DIR/venv/bin/python run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable nas.service
sudo systemctl restart nas.service

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "  ✅  Deploy completado con éxito"
echo "============================================"
echo "  🌐  URL:        http://${SERVER_IP}"
echo "  👤  Usuario:    root"
echo "  🔑  Contraseña: root"
echo "  ⚠️  Cambia la contraseña tras el primer login"
echo "============================================"
