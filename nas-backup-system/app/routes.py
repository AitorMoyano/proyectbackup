from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import User, Backup, Raid, Group, Share
from app.utils import *
from werkzeug.security import generate_password_hash
from datetime import datetime
import os
import shutil

bp = Blueprint('routes', __name__)

@bp.route('/')
def index():
    return redirect(url_for('routes.login'))

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username']).first()
        if user and user.check_password(request.form['password']):
            login_user(user)
            return redirect(url_for('routes.dashboard'))
        flash('Usuario o contraseña incorrectos')
    return render_template('login.html')

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('routes.login'))

@bp.route('/dashboard')
@login_required
def dashboard():
    clients = get_network_clients()
    backups = Backup.query.order_by(Backup.created_at.desc()).limit(10).all()
    raids = Raid.query.all()
    completed = Backup.query.filter_by(status='completed').count()
    return render_template('dashboard.html', clients=clients, backups=backups, raids=raids, completed=completed)

@bp.route('/backups')
@login_required
def backups():
    backups = Backup.query.order_by(Backup.created_at.desc()).all()
    return render_template('backups.html', backups=backups)

@bp.route('/api/backup', methods=['POST'])
@login_required
def create_backup():
    data = request.json
    share_id = data.get('share_id')

    if share_id:
        share = Share.query.get_or_404(share_id)
        source_path = share.path
        client_name = share.name
        client_ip   = 'localhost'
    else:
        source_path = data.get('path', '/srv/nas/shares/')
        client_name = data.get('client_name', 'manual')
        client_ip   = 'localhost'

    timestamp   = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = f"{current_app.config['BACKUP_DIR']}/{client_name}_{timestamp}"

    os.makedirs(current_app.config['BACKUP_DIR'], exist_ok=True)
    os.makedirs(backup_path, exist_ok=True)

    cmd    = f"rsync -av {source_path}/ {backup_path}/"
    result = run_command(cmd)

    backup = Backup(
        client_ip   = client_ip,
        client_name = client_name,
        backup_path = backup_path,
        size        = get_folder_size(backup_path),
        status      = 'completed' if result['success'] else 'failed'
    )
    db.session.add(backup)
    db.session.commit()
    return jsonify({'success': result['success'], 'error': result.get('error', ''), 'id': backup.id})

@bp.route('/api/restore/<int:backup_id>', methods=['POST'])
@login_required
def restore_backup(backup_id):
    backup = Backup.query.get_or_404(backup_id)
    data = request.json
    target = data['target']
    
    cmd = f"sudo rsync -a --progress {backup.backup_path}/ {target}"
    result = run_command(cmd)
    
    backup.status = 'restored'
    db.session.commit()
    
    return jsonify(result)

@bp.route('/raid')
@login_required
def raid():
    raids = Raid.query.all()
    disks = get_disks()
    return render_template('raids.html', raids=raids, disks=disks)

@bp.route('/api/raid/create', methods=['POST'])
@login_required
def create_raid():
    data = request.json
    level = data['level']
    devices = data['devices']
    
    cmd = f"yes | sudo mdadm --create --verbose /dev/md{len(Raid.query.all())} --level={level} --raid-devices={len(devices)} {' '.join(devices)}"
    result = run_command(cmd)
    
    if result['success']:
        raid_name = f"raid-{level}-{datetime.now().strftime('%Y%m%d')}"
        raid = Raid(name=raid_name, level=level, devices=str(devices), size=0)
        db.session.add(raid)
        db.session.commit()
    
    return jsonify(result)

@bp.route('/users')
@login_required
def users():
    if not current_user.is_admin:
        flash('Acceso denegado')
        return redirect(url_for('routes.dashboard'))
    users = User.query.all()
    return render_template('users.html', users=users)

@bp.route('/api/users', methods=['POST'])
@login_required
def manage_users():
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    data = request.json
    if data['action'] == 'create':
        user = User(
            username=data['username'],
            email=data['email'],
            is_admin=data.get('is_admin', False)
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'success': True})
    
    return jsonify({'error': 'Acción no válida'}), 400
    # AGREGAR ESTAS RUTAS AL FINAL de routes.py

@bp.route('/api/backup/<int:backup_id>/delete', methods=['DELETE'])
@login_required
def delete_backup(backup_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    backup = Backup.query.get_or_404(backup_id)
    try:
        shutil.rmtree(backup.backup_path)
        db.session.delete(backup)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/users/<int:user_id>/delete', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'error': 'No puedes eliminarte a ti mismo'}), 400
    
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})

# Actualizar contador de clientes en dashboard
@bp.route('/api/clients/count')
@login_required
def clients_count():
    return jsonify({'count': len(get_network_clients())})

# ----------------------------------------------------------------
# GROUPS
# ----------------------------------------------------------------
@bp.route('/groups')
@login_required
def groups():
    if not current_user.is_admin:
        flash('Acceso denegado')
        return redirect(url_for('routes.dashboard'))
    all_groups = Group.query.order_by(Group.name).all()
    all_users  = User.query.order_by(User.username).all()
    return render_template('groups.html', groups=all_groups, users=all_users)

@bp.route('/api/groups', methods=['POST'])
@login_required
def manage_groups():
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403

    data   = request.json
    action = data.get('action')

    if action == 'create':
        if Group.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Ya existe un grupo con ese nombre'}), 400
        group = Group(name=data['name'], description=data.get('description', ''))
        db.session.add(group)
        db.session.commit()
        return jsonify({'success': True, 'id': group.id})

    elif action == 'add_user':
        group = Group.query.get_or_404(data['group_id'])
        user  = User.query.get_or_404(data['user_id'])
        if user not in group.members:
            group.members.append(user)
            db.session.commit()
        return jsonify({'success': True})

    elif action == 'remove_user':
        group = Group.query.get_or_404(data['group_id'])
        user  = User.query.get_or_404(data['user_id'])
        if user in group.members:
            group.members.remove(user)
            db.session.commit()
        return jsonify({'success': True})

    return jsonify({'error': 'Acción no válida'}), 400

@bp.route('/api/groups/<int:group_id>/delete', methods=['DELETE'])
@login_required
def delete_group(group_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    group = Group.query.get_or_404(group_id)
    db.session.delete(group)
    db.session.commit()
    return jsonify({'success': True})

# ----------------------------------------------------------------
# FILE STATION
# ----------------------------------------------------------------
@bp.route('/files')
@login_required
def files():
    shares = Share.query.order_by(Share.name).all()
    return render_template('files.html', shares=shares)

@bp.route('/api/shares', methods=['POST'])
@login_required
def manage_shares():
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    data   = request.json
    action = data.get('action')

    if action == 'create':
        name = data['name'].strip().replace(' ', '_')
        if Share.query.filter_by(name=name).first():
            return jsonify({'error': 'Ya existe un recurso compartido con ese nombre'}), 400
        path = f"/srv/nas/shares/{name}"
        share = Share(
            name        = name,
            path        = path,
            description = data.get('description', ''),
            is_public   = data.get('is_public', False),
            read_only   = data.get('read_only', False)
        )
        db.session.add(share)
        db.session.commit()
        run_command(f"sudo mkdir -p {path}")
        run_command(f"sudo chmod 775 {path}")
        run_command(f"sudo chown nobody:nogroup {path}")
        update_samba_config()
        return jsonify({'success': True, 'id': share.id})

    elif action == 'delete':
        share = Share.query.get_or_404(data['share_id'])
        run_command(f"sudo rm -rf {share.path}")
        db.session.delete(share)
        db.session.commit()
        update_samba_config()
        return jsonify({'success': True})

    return jsonify({'error': 'Acción no válida'}), 400

@bp.route('/api/files/browse')
@login_required
def browse_files():
    path = request.args.get('path', '/srv/nas/shares')
    real = os.path.realpath(path)
    if not real.startswith('/srv/nas/shares'):
        return jsonify({'error': 'Ruta no permitida'}), 403
    if not os.path.isdir(real):
        return jsonify({'error': 'No es un directorio'}), 404
    entries = []
    try:
        for name in sorted(os.listdir(real)):
            full = os.path.join(real, name)
            stat = os.stat(full)
            entries.append({
                'name'     : name,
                'path'     : full,
                'is_dir'   : os.path.isdir(full),
                'size'     : stat.st_size,
                'modified' : datetime.fromtimestamp(stat.st_mtime).strftime('%d/%m/%Y %H:%M')
            })
    except PermissionError:
        return jsonify({'error': 'Sin permisos para leer este directorio'}), 403
    return jsonify({'path': real, 'entries': entries})

@bp.route('/api/files/mkdir', methods=['POST'])
@login_required
def make_dir():
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    data = request.json
    path = data.get('path', '').strip()
    real = os.path.realpath(path)
    if not real.startswith('/srv/nas/shares'):
        return jsonify({'error': 'Ruta no permitida'}), 403
    try:
        os.makedirs(real, exist_ok=True)
        return jsonify({'success': True})
    except Exception as e:
        result = run_command(f"sudo mkdir -p '{real}'")
        return jsonify({'success': result['success'], 'error': result.get('error', '')})

@bp.route('/api/files/delete', methods=['DELETE'])
@login_required
def delete_file_or_dir():
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    data = request.json
    path = data.get('path', '').strip()
    real = os.path.realpath(path)
    if not real.startswith('/srv/nas/shares') or real == '/srv/nas/shares':
        return jsonify({'error': 'Ruta no permitida'}), 403
    result = run_command(f"sudo rm -rf '{real}'")
    return jsonify({'success': result['success'], 'error': result.get('error', '')})

@bp.route('/api/files/upload', methods=['POST'])
@login_required
def upload_file():
    path = request.form.get('path', '/srv/nas/shares')
    real = os.path.realpath(path)
    if not real.startswith('/srv/nas/shares'):
        return jsonify({'error': 'Ruta no permitida'}), 403
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo'}), 400
    f = request.files['file']
    dest = os.path.join(real, f.filename)
    try:
        f.save(dest)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500