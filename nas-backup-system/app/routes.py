from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import User, Backup, Raid, Group, Share
from app.utils import *
from datetime import datetime
import os, shutil

bp = Blueprint('routes', __name__)

# ── Auth ──────────────────────────────────────────────────────
@bp.route('/')
def index(): return redirect(url_for('routes.login'))

@bp.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        u = User.query.filter_by(username=request.form['username']).first()
        if u and u.check_password(request.form['password']):
            login_user(u)
            return redirect(url_for('routes.dashboard'))
        flash('Usuario o contraseña incorrectos')
    return render_template('login.html')

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('routes.login'))

# ── Dashboard ─────────────────────────────────────────────────
@bp.route('/dashboard')
@login_required
def dashboard():
    network  = current_app.config['NETWORK_RANGE']
    clients  = get_network_clients(network)
    backups  = Backup.query.order_by(Backup.created_at.desc()).limit(10).all()
    raids    = Raid.query.all()
    shares   = Share.query.all()
    completed = Backup.query.filter_by(status='completed').count()
    return render_template('dashboard.html',
        clients=clients, backups=backups, raids=raids, shares=shares,
        completed=completed, server_ip=current_app.config['SERVER_IP'])

# ── Backups ───────────────────────────────────────────────────
@bp.route('/backups')
@login_required
def backups():
    all_backups = Backup.query.order_by(Backup.created_at.desc()).all()
    shares = Share.query.all()
    return render_template('backups.html', backups=all_backups, shares=shares)

@bp.route('/api/backup', methods=['POST'])
@login_required
def create_backup():
    data     = request.json
    share_id = data.get('share_id')
    if share_id:
        share = Share.query.get_or_404(int(share_id))
        src   = share.path
        name  = share.name
    else:
        src  = current_app.config['SHARES_DIR']
        name = 'completo'

    ts    = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest  = os.path.join(current_app.config['BACKUP_DIR'], f"{name}_{ts}")
    os.makedirs(dest, exist_ok=True)

    result = run_cmd(f"rsync -av --delete {src}/ {dest}/", timeout=300)
    size   = get_folder_size(dest)

    bk = Backup(source_name=name, backup_path=dest, size=size,
                status='completed' if result['success'] else 'failed')
    db.session.add(bk)
    db.session.commit()
    return jsonify({'success': result['success'], 'error': result.get('error',''), 'id': bk.id})

@bp.route('/api/backup/<int:bid>/restore', methods=['POST'])
@login_required
def restore_backup(bid):
    bk     = Backup.query.get_or_404(bid)
    target = request.json.get('target','').strip()
    if not target: return jsonify({'error': 'Ruta de destino requerida'}), 400
    real = os.path.realpath(target)
    result = run_cmd(f"rsync -av {bk.backup_path}/ {real}/")
    if result['success']:
        bk.status = 'restored'
        db.session.commit()
    return jsonify(result)

@bp.route('/api/backup/<int:bid>/delete', methods=['DELETE'])
@login_required
def delete_backup(bid):
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    bk = Backup.query.get_or_404(bid)
    try:
        if os.path.exists(bk.backup_path): shutil.rmtree(bk.backup_path)
        db.session.delete(bk)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── RAID ──────────────────────────────────────────────────────
@bp.route('/raid')
@login_required
def raid():
    return render_template('raids.html', raids=Raid.query.all(), disks=get_disks())

@bp.route('/api/raid/create', methods=['POST'])
@login_required
def create_raid():
    data    = request.json
    level   = data['level']
    devices = data['devices']
    md_num  = len(Raid.query.all())
    cmd     = (f"yes | sudo mdadm --create --verbose /dev/md{md_num} "
               f"--level={level} --raid-devices={len(devices)} {' '.join(devices)}")
    result  = run_cmd(cmd, timeout=60)
    if result['success']:
        r = Raid(name=f"md{md_num}-raid{level}", level=level,
                 devices=','.join(devices), size=0)
        db.session.add(r)
        db.session.commit()
    return jsonify(result)

@bp.route('/api/raid/<int:rid>/delete', methods=['DELETE'])
@login_required
def delete_raid(rid):
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    r = Raid.query.get_or_404(rid)
    db.session.delete(r)
    db.session.commit()
    return jsonify({'success': True})

# ── Users ─────────────────────────────────────────────────────
@bp.route('/users')
@login_required
def users():
    if not current_user.is_admin:
        flash('Acceso denegado'); return redirect(url_for('routes.dashboard'))
    return render_template('users.html', users=User.query.all())

@bp.route('/api/users', methods=['POST'])
@login_required
def manage_users():
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    d = request.json
    if d.get('action') == 'create':
        if User.query.filter_by(username=d['username']).first():
            return jsonify({'error': 'El usuario ya existe'}), 400
        u = User(username=d['username'], email=d['email'], is_admin=d.get('is_admin',False))
        u.set_password(d['password'])
        db.session.add(u); db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Acción no válida'}), 400

@bp.route('/api/users/<int:uid>/delete', methods=['DELETE'])
@login_required
def delete_user(uid):
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    u = User.query.get_or_404(uid)
    if u.id == current_user.id: return jsonify({'error':'No puedes eliminarte a ti mismo'}),400
    db.session.delete(u); db.session.commit()
    return jsonify({'success': True})

# ── Groups ────────────────────────────────────────────────────
@bp.route('/groups')
@login_required
def groups():
    if not current_user.is_admin:
        flash('Acceso denegado'); return redirect(url_for('routes.dashboard'))
    return render_template('groups.html',
        groups=Group.query.order_by(Group.name).all(),
        users=User.query.order_by(User.username).all())

@bp.route('/api/groups', methods=['POST'])
@login_required
def manage_groups():
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    d = request.json; action = d.get('action')
    if action == 'create':
        if Group.query.filter_by(name=d['name']).first():
            return jsonify({'error':'Ya existe ese grupo'}),400
        g = Group(name=d['name'], description=d.get('description',''))
        db.session.add(g); db.session.commit()
        return jsonify({'success':True,'id':g.id})
    if action == 'add_user':
        g = Group.query.get_or_404(d['group_id'])
        u = User.query.get_or_404(d['user_id'])
        if u not in g.members: g.members.append(u); db.session.commit()
        return jsonify({'success':True})
    if action == 'remove_user':
        g = Group.query.get_or_404(d['group_id'])
        u = User.query.get_or_404(d['user_id'])
        if u in g.members: g.members.remove(u); db.session.commit()
        return jsonify({'success':True})
    return jsonify({'error':'Acción no válida'}),400

@bp.route('/api/groups/<int:gid>/delete', methods=['DELETE'])
@login_required
def delete_group(gid):
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    g = Group.query.get_or_404(gid)
    db.session.delete(g); db.session.commit()
    return jsonify({'success':True})

# ── File Station ──────────────────────────────────────────────
@bp.route('/files')
@login_required
def files():
    shares = Share.query.order_by(Share.name).all()
    server_ip = current_app.config['SERVER_IP']
    return render_template('files.html', shares=shares, server_ip=server_ip)

@bp.route('/api/shares', methods=['POST'])
@login_required
def manage_shares():
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    d = request.json; action = d.get('action')

    if action == 'create':
        name = d['name'].strip().replace(' ','_').lower()
        if not name: return jsonify({'error':'Nombre requerido'}),400
        if Share.query.filter_by(name=name).first():
            return jsonify({'error':'Ya existe ese recurso compartido'}),400
        path = os.path.join(current_app.config['SHARES_DIR'], name)
        s = Share(name=name, path=path,
                  description=d.get('description',''),
                  is_public=d.get('is_public', True),
                  read_only=d.get('read_only', False))
        db.session.add(s); db.session.commit()
        run_cmd(f"sudo mkdir -p {path}")
        run_cmd(f"sudo chmod 777 {path}")
        run_cmd(f"sudo chown nobody:nogroup {path} 2>/dev/null || sudo chown nobody:nobody {path}")
        rebuild_samba(Share.query.all(), current_app.config['SERVER_IP'])
        return jsonify({'success':True,'id':s.id,'path':path})

    if action == 'delete':
        s = Share.query.get_or_404(d['share_id'])
        run_cmd(f"sudo rm -rf {s.path}")
        db.session.delete(s); db.session.commit()
        rebuild_samba(Share.query.all(), current_app.config['SERVER_IP'])
        return jsonify({'success':True})

    return jsonify({'error':'Acción no válida'}),400

def _safe_path(path):
    """Return realpath only if inside SHARES_DIR, else None"""
    base = os.path.realpath(current_app.config['SHARES_DIR'])
    real = os.path.realpath(path)
    return real if real.startswith(base) else None

@bp.route('/api/files/browse')
@login_required
def browse_files():
    path = request.args.get('path', current_app.config['SHARES_DIR'])
    real = _safe_path(path)
    if not real: return jsonify({'error':'Ruta no permitida'}),403
    if not os.path.isdir(real): return jsonify({'error':'No es un directorio'}),404
    entries = []
    try:
        for name in sorted(os.listdir(real)):
            full = os.path.join(real, name)
            try:
                st = os.stat(full)
                entries.append({
                    'name': name, 'path': full,
                    'is_dir': os.path.isdir(full),
                    'size': st.st_size,
                    'modified': datetime.fromtimestamp(st.st_mtime).strftime('%d/%m/%Y %H:%M')
                })
            except: pass
    except PermissionError:
        return jsonify({'error':'Sin permisos'}),403
    return jsonify({'path': real, 'entries': entries,
                    'shares_dir': current_app.config['SHARES_DIR']})

@bp.route('/api/files/mkdir', methods=['POST'])
@login_required
def make_dir():
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    path = request.json.get('path','').strip()
    real = _safe_path(path)
    if not real: return jsonify({'error':'Ruta no permitida'}),403
    result = run_cmd(f"sudo mkdir -p '{real}' && sudo chmod 775 '{real}'")
    return jsonify(result)

@bp.route('/api/files/delete', methods=['DELETE'])
@login_required
def delete_file():
    if not current_user.is_admin: return jsonify({'error':'Acceso denegado'}),403
    path = request.json.get('path','').strip()
    real = _safe_path(path)
    base = os.path.realpath(current_app.config['SHARES_DIR'])
    if not real or real == base: return jsonify({'error':'Ruta no permitida'}),403
    result = run_cmd(f"sudo rm -rf '{real}'")
    return jsonify(result)

@bp.route('/api/files/upload', methods=['POST'])
@login_required
def upload_file():
    import tempfile
    path = request.form.get('path', current_app.config['SHARES_DIR'])
    real = _safe_path(path)
    if not real: return jsonify({'error':'Ruta no permitida'}),403
    if 'file' not in request.files: return jsonify({'error':'Sin archivo'}),400
    f = request.files['file']
    if not f.filename: return jsonify({'error':'Nombre de archivo inválido'}),400
    # Guardar primero en /tmp (siempre tenemos permiso) y luego mover con sudo
    tmp = tempfile.mktemp(prefix='nas_upload_')
    try:
        f.save(tmp)
        dest = os.path.join(real, f.filename)
        result = run_cmd(f"sudo mv '{tmp}' '{dest}' && sudo chmod 664 '{dest}'")
        if result['success']:
            return jsonify({'success': True})
        return jsonify({'error': result.get('error', 'Error al mover el fichero')}), 500
    except Exception as e:
        run_cmd(f"rm -f '{tmp}'")
        return jsonify({'error': str(e)}), 500
