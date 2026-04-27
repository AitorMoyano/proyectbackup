#!/bin/bash
set -e

# ============================================================
#  NAS Backup System — Deploy automático
#  Uso: sudo ./deploy.sh
# ============================================================

# ── Auto-detect environment ──────────────────────────────────
DEPLOY_USER=$(logname 2>/dev/null || whoami)
SERVER_IP=$(hostname -I | awk '{print $1}')
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_KEY=$(openssl rand -hex 32)

echo ""
echo "============================================"
echo "  NAS Backup System — Deploy"
echo "============================================"
echo "  Usuario:    $DEPLOY_USER"
echo "  IP:         $SERVER_IP"
echo "  Directorio: $PROJECT_DIR"
echo "============================================"
echo ""

# ── [1/8] Dependencias del sistema ──────────────────────────
echo "🔧 [1/8] Instalando dependencias del sistema..."
apt-get update -qq
apt-get install -y \
    python3 python3-pip python3-venv \
    nginx rsync nmap mdadm \
    samba samba-common-bin \
    2>/dev/null

echo "    ✓ Dependencias instaladas"

# ── [2/8] Directorios NAS ────────────────────────────────────
echo "📁 [2/8] Creando directorios NAS..."
mkdir -p /srv/nas/shares /srv/nas/backups
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /srv/nas
chmod -R 775 /srv/nas
echo "    ✓ /srv/nas/shares y /srv/nas/backups creados"

# ── [3/8] Entorno virtual Python ────────────────────────────
echo "🐍 [3/8] Configurando entorno virtual Python..."
if [ ! -d "$PROJECT_DIR/venv" ]; then
    sudo -u "$DEPLOY_USER" python3 -m venv "$PROJECT_DIR/venv"
fi
sudo -u "$DEPLOY_USER" "$PROJECT_DIR/venv/bin/pip" install --quiet --upgrade pip
sudo -u "$DEPLOY_USER" "$PROJECT_DIR/venv/bin/pip" install --quiet -r "$PROJECT_DIR/requirements.txt"
echo "    ✓ venv configurado en $PROJECT_DIR/venv"

# ── [4/8] Fichero .env ───────────────────────────────────────
echo "⚙️  [4/8] Generando fichero .env..."
cat > "$PROJECT_DIR/.env" <<EOF
SECRET_KEY=$SECRET_KEY
DATABASE_URL=sqlite:///nas.db
BACKUP_DIR=/srv/nas/backups
SHARES_DIR=/srv/nas/shares
SERVER_IP=$SERVER_IP
FLASK_ENV=production
EOF
chown "$DEPLOY_USER":"$DEPLOY_USER" "$PROJECT_DIR/.env"
chmod 600 "$PROJECT_DIR/.env"
echo "    ✓ .env creado (SECRET_KEY aleatoria)"

# ── [5/8] Inicializar base de datos ─────────────────────────
echo "🗃️  [5/8] Inicializando base de datos..."
cd "$PROJECT_DIR"
sudo -u "$DEPLOY_USER" bash -c "
    cd '$PROJECT_DIR'
    '$PROJECT_DIR/venv/bin/python' run.py &
    sleep 3
    kill %1 2>/dev/null || true
" 2>/dev/null || true
echo "    ✓ Base de datos SQLite inicializada"

# ── [6/8] Servicio systemd ───────────────────────────────────
echo "🔄 [6/8] Configurando servicio systemd..."
cat > /etc/systemd/system/nas-backup.service <<EOF
[Unit]
Description=NAS Backup System
After=network.target

[Service]
User=$DEPLOY_USER
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=$PROJECT_DIR/venv/bin/python run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nas-backup.service
systemctl restart nas-backup.service
echo "    ✓ Servicio nas-backup.service activo"

# ── [7/8] Nginx ──────────────────────────────────────────────
echo "🌐 [7/8] Configurando Nginx..."
cat > /etc/nginx/sites-available/nas-backup <<EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 500M;

    location /static/ {
        alias $PROJECT_DIR/app/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nas-backup /etc/nginx/sites-enabled/nas-backup
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx
echo "    ✓ Nginx configurado y recargado"

# ── [8/8] Samba (configuración base) ────────────────────────
echo "📂 [8/8] Configurando Samba base..."
cat > /etc/samba/smb.conf <<EOF
[global]
   workgroup = WORKGROUP
   server string = NAS Server ($SERVER_IP)
   netbios name = NASSERVER
   security = user
   map to guest = Bad User
   log level = 1
   max log size = 1000
EOF

systemctl enable smbd nmbd 2>/dev/null || true
systemctl restart smbd nmbd 2>/dev/null || true
echo "    ✓ Samba configurado (los recursos se gestionan desde la app)"

# ── Sudoers para comandos NAS ────────────────────────────────
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/rsync, /usr/sbin/mdadm, /usr/bin/nmap, /bin/cp, /bin/mkdir, /bin/chmod, /bin/chown, /bin/rm, /usr/bin/tee, /bin/systemctl reload smbd, /bin/systemctl restart smbd" \
    > /etc/sudoers.d/nas-backup
chmod 440 /etc/sudoers.d/nas-backup
echo "    ✓ Sudoers configurado para $DEPLOY_USER"

# ── Resumen ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  ✅  Deploy completado con éxito"
echo "============================================"
echo "  🌐  URL:         http://${SERVER_IP}"
echo "  👤  Usuario:     root"
echo "  🔑  Contraseña:  root"
echo "  📁  Shares:      /srv/nas/shares"
echo "  💾  Backups:     /srv/nas/backups"
echo "  📡  Samba:       smb://${SERVER_IP}/<recurso>"
echo ""
echo "  ⚠️  Cambia la contraseña root tras el primer login"
echo "============================================"
echo ""
