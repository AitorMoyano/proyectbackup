'use strict';

// ============================================================
// UTILITIES
// ============================================================

function showToast(message, type) {
    type = type || 'info';
    var toast = document.getElementById('mainToast');
    var toastText = document.getElementById('toastText');
    var toastIcon = document.getElementById('toastIcon');
    if (!toast) return;

    toast.className = 'toast align-items-center toast-' + type;

    var icons = {
        success: 'bi-check-circle-fill',
        danger:  'bi-x-circle-fill',
        info:    'bi-info-circle-fill',
        warning: 'bi-exclamation-triangle-fill'
    };
    var colors = {
        success: 'var(--success)',
        danger:  'var(--danger)',
        info:    'var(--accent)',
        warning: 'var(--warning)'
    };

    toastIcon.className = 'bi ' + (icons[type] || icons.info);
    toastIcon.style.color = colors[type] || colors.info;
    if (toastText) toastText.textContent = message;

    var bsToast = bootstrap.Toast.getOrCreateInstance(toast, { delay: 4000 });
    bsToast.show();
}

function setLoading(btn, loading) {
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Procesando...';
        btn.disabled = true;
    } else {
        if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
        btn.disabled = false;
    }
}

function getModal(id) {
    var el = document.getElementById(id);
    return el ? bootstrap.Modal.getOrCreateInstance(el) : null;
}

function hideModal(id) {
    var m = getModal(id);
    if (m) m.hide();
}

// Sidebar toggle for mobile
function toggleSidebar() {
    var sidebar  = document.getElementById('sidebar');
    var overlay  = document.getElementById('sidebarOverlay');
    if (sidebar)  sidebar.classList.toggle('open');
    if (overlay)  overlay.classList.toggle('open');
}

// ============================================================
// MAIN INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

    // ----------------------------------------------------------------
    // DASHBOARD — Backup creation
    // ----------------------------------------------------------------
    var pendingBackupIp   = null;
    var pendingBackupName = null;

    document.querySelectorAll('.backup-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingBackupIp   = this.dataset.ip;
            pendingBackupName = this.dataset.name;
            var nameEl = document.getElementById('backupClientName');
            var ipEl   = document.getElementById('backupClientIp');
            if (nameEl) nameEl.textContent = pendingBackupName;
            if (ipEl)   ipEl.textContent   = pendingBackupIp;
            var m = getModal('backupModal');
            if (m) m.show();
        });
    });

    var confirmBackupBtn = document.getElementById('confirmBackupBtn');
    if (confirmBackupBtn) {
        confirmBackupBtn.addEventListener('click', function () {
            if (!pendingBackupIp) return;
            setLoading(this, true);
            var self = this;
            fetch('/api/backup', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ client_ip: pendingBackupIp, client_name: pendingBackupName, share: 'backup' })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('backupModal');
                if (data.success) {
                    showToast('Backup completado para ' + pendingBackupName, 'success');
                } else {
                    showToast('Error en backup: ' + (data.error || data.output || 'No se pudo crear el backup'), 'danger');
                }
                setTimeout(function () { location.reload(); }, 2000);
            })
            .catch(function () {
                showToast('Error de conexión con el servidor', 'danger');
                setTimeout(function () { location.reload(); }, 2000);
            })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // BACKUPS — Restore
    // ----------------------------------------------------------------
    var pendingRestoreId = null;

    document.querySelectorAll('.restore-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingRestoreId = this.dataset.id;
            var nameEl = document.getElementById('restoreClientName');
            if (nameEl) nameEl.textContent = this.dataset.name || '';
            var input = document.getElementById('restoreTarget');
            if (input) { input.value = ''; input.classList.remove('is-invalid'); }
            var m = getModal('restoreModal');
            if (m) m.show();
            setTimeout(function () {
                var inp = document.getElementById('restoreTarget');
                if (inp) inp.focus();
            }, 350);
        });
    });

    var restoreTarget = document.getElementById('restoreTarget');
    if (restoreTarget) {
        restoreTarget.addEventListener('input', function () { this.classList.remove('is-invalid'); });
    }

    var confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    if (confirmRestoreBtn) {
        confirmRestoreBtn.addEventListener('click', function () {
            var target = (document.getElementById('restoreTarget') || {}).value;
            if (!target || !target.trim()) {
                var inp = document.getElementById('restoreTarget');
                if (inp) inp.classList.add('is-invalid');
                return;
            }
            setLoading(this, true);
            var self = this;
            fetch('/api/restore/' + pendingRestoreId, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ target: target.trim() })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('restoreModal');
                if (data.success) {
                    showToast('Restauración completada correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1500);
                } else {
                    showToast('Error al restaurar: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // BACKUPS — Delete
    // ----------------------------------------------------------------
    var pendingDeleteBackupId = null;

    document.querySelectorAll('.delete-backup').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingDeleteBackupId = this.dataset.id;
            var nameEl = document.getElementById('deleteBackupName');
            if (nameEl) nameEl.textContent = this.dataset.name || '';
            var m = getModal('deleteBackupModal');
            if (m) m.show();
        });
    });

    var confirmDeleteBackupBtn = document.getElementById('confirmDeleteBackupBtn');
    if (confirmDeleteBackupBtn) {
        confirmDeleteBackupBtn.addEventListener('click', function () {
            setLoading(this, true);
            var self = this;
            fetch('/api/backup/' + pendingDeleteBackupId + '/delete', { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('deleteBackupModal');
                if (data.success) {
                    showToast('Backup eliminado correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1000);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // RAID — Create
    // ----------------------------------------------------------------
    var createRaidBtn = document.getElementById('create-raid');
    if (createRaidBtn) {
        createRaidBtn.addEventListener('click', function () {
            var devices = Array.from(
                document.querySelectorAll('input[name="raid-devices"]:checked')
            ).map(function (cb) { return cb.value; });

            if (devices.length < 2) {
                showToast('Selecciona al menos 2 discos para crear un RAID', 'warning');
                return;
            }

            var level = (document.getElementById('raid-level') || {}).value;
            var levelInfo = document.getElementById('raidLevelInfo');
            var diskCount = document.getElementById('raidDiskCount');
            var diskList  = document.getElementById('raidDiskList');
            if (levelInfo) levelInfo.textContent = level;
            if (diskCount) diskCount.textContent  = devices.length;
            if (diskList)  diskList.textContent    = devices.join('   ·   ');

            var m = getModal('raidModal');
            if (m) m.show();
        });
    }

    var confirmRaidBtn = document.getElementById('confirmRaidBtn');
    if (confirmRaidBtn) {
        confirmRaidBtn.addEventListener('click', function () {
            var level   = (document.getElementById('raid-level') || {}).value;
            var devices = Array.from(
                document.querySelectorAll('input[name="raid-devices"]:checked')
            ).map(function (cb) { return cb.value; });

            setLoading(this, true);
            var self = this;
            fetch('/api/raid/create', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ level: level, devices: devices })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('raidModal');
                if (data.success) {
                    showToast('Matriz RAID ' + level + ' creada correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1500);
                } else {
                    showToast('Error al crear RAID: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // USERS — Create
    // ----------------------------------------------------------------
    var createUserBtn = document.getElementById('create-user');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', function () {
            var username = (document.getElementById('new-username') || {}).value || '';
            var email    = (document.getElementById('new-email')    || {}).value || '';
            var password = (document.getElementById('new-password') || {}).value || '';
            var is_admin = (document.getElementById('new-is-admin') || {}).checked || false;

            username = username.trim();
            email    = email.trim();

            if (!username || !email || !password) {
                showToast('Completa todos los campos obligatorios', 'warning');
                return;
            }

            setLoading(this, true);
            var self = this;
            fetch('/api/users', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'create', username: username, email: email, password: password, is_admin: is_admin })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showToast('Usuario "' + username + '" creado correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1200);
                } else {
                    showToast('Error: ' + (data.error || 'No se pudo crear el usuario'), 'danger');
                    setLoading(self, false);
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); setLoading(self, false); });
        });
    }

    // Toggle password visibility
    var togglePasswordBtn = document.getElementById('togglePassword');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function () {
            var input = document.getElementById('new-password');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = '<i class="bi bi-eye-slash"></i>';
            } else {
                input.type = 'password';
                this.innerHTML = '<i class="bi bi-eye"></i>';
            }
        });
    }

    // ----------------------------------------------------------------
    // USERS — Delete
    // ----------------------------------------------------------------
    var pendingDeleteUserId = null;

    document.querySelectorAll('.delete-user').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingDeleteUserId = this.dataset.id;
            var nameEl = document.getElementById('deleteUserName');
            if (nameEl) nameEl.textContent = this.dataset.name || '';
            var m = getModal('deleteUserModal');
            if (m) m.show();
        });
    });

    var confirmDeleteUserBtn = document.getElementById('confirmDeleteUserBtn');
    if (confirmDeleteUserBtn) {
        confirmDeleteUserBtn.addEventListener('click', function () {
            setLoading(this, true);
            var self = this;
            fetch('/api/users/' + pendingDeleteUserId + '/delete', { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('deleteUserModal');
                if (data.success) {
                    showToast('Usuario eliminado correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1000);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // GROUPS — Create
    // ----------------------------------------------------------------
    var createGroupBtn = document.getElementById('create-group');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', function () {
            var name  = ((document.getElementById('group-name')        || {}).value || '').trim();
            var desc  = ((document.getElementById('group-description') || {}).value || '').trim();

            if (!name) {
                showToast('El nombre del grupo es obligatorio', 'warning');
                return;
            }

            setLoading(this, true);
            var self = this;
            fetch('/api/groups', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'create', name: name, description: desc })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showToast('Grupo "' + name + '" creado correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1200);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // GROUPS — Delete
    var pendingDeleteGroupId = null;

    document.querySelectorAll('.delete-group').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingDeleteGroupId = this.dataset.id;
            var nameEl = document.getElementById('deleteGroupName');
            if (nameEl) nameEl.textContent = this.dataset.name || '';
            var m = getModal('deleteGroupModal');
            if (m) m.show();
        });
    });

    var confirmDeleteGroupBtn = document.getElementById('confirmDeleteGroupBtn');
    if (confirmDeleteGroupBtn) {
        confirmDeleteGroupBtn.addEventListener('click', function () {
            setLoading(this, true);
            var self = this;
            fetch('/api/groups/' + pendingDeleteGroupId + '/delete', { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hideModal('deleteGroupModal');
                if (data.success) {
                    showToast('Grupo eliminado correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 1000);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // GROUPS — Add member
    document.querySelectorAll('.add-member').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var groupId = this.dataset.groupId;
            var userId  = this.dataset.userId;
            fetch('/api/groups', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'add_user', group_id: parseInt(groupId), user_id: parseInt(userId) })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showToast('Usuario añadido al grupo', 'success');
                    setTimeout(function () { location.reload(); }, 800);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); });
        });
    });

    // GROUPS — Remove member
    document.querySelectorAll('.remove-member').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var groupId = this.dataset.groupId;
            var userId  = this.dataset.userId;
            fetch('/api/groups', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'remove_user', group_id: parseInt(groupId), user_id: parseInt(userId) })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showToast('Usuario eliminado del grupo', 'info');
                    setTimeout(function () { location.reload(); }, 800);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); });
        });
    });

    // GROUPS — Quick add member (select dropdowns)
    var quickAddBtn = document.getElementById('quick-add-member');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', function () {
            var groupId = (document.getElementById('quick-group') || {}).value;
            var userId  = (document.getElementById('quick-user')  || {}).value;
            if (!groupId || !userId) return;
            setLoading(this, true);
            var self = this;
            fetch('/api/groups', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action: 'add_user', group_id: parseInt(groupId), user_id: parseInt(userId) })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showToast('Usuario añadido al grupo correctamente', 'success');
                    setTimeout(function () { location.reload(); }, 900);
                } else {
                    showToast('Error: ' + (data.error || ''), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
        });
    }

    // ----------------------------------------------------------------
    // AUTO-REFRESH — Dashboard y Backups cada 30 segundos
    // ----------------------------------------------------------------
    var isDashboard = !!document.getElementById('clientList');
    var isBackups   = !!document.getElementById('backupsList');
    if (isDashboard || isBackups) {
        setInterval(function () { location.reload(); }, 30000);

        // Contador visual de próxima actualización
        var counter = document.getElementById('autoRefreshCounter');
        if (counter) {
            var secs = 30;
            setInterval(function () {
                secs--;
                if (secs <= 0) secs = 30;
                counter.textContent = secs + 's';
            }, 1000);
        }
    }

    // ----------------------------------------------------------------
    // FILE STATION
    // ----------------------------------------------------------------
    var currentBrowsePath = null;

    // Browse a share when clicking on it
    document.querySelectorAll('.browse-share').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var path = this.dataset.path;
            document.querySelectorAll('.share-item').forEach(function(el) { el.classList.remove('active'); });
            var item = btn.closest('.share-item');
            if (item) item.classList.add('active');
            loadDirectory(path);
        });
    });

    function loadDirectory(path) {
        currentBrowsePath = path;
        var explorer = document.getElementById('fileExplorer');
        var breadcrumb = document.getElementById('fileBreadcrumb');
        if (!explorer) return;

        explorer.innerHTML = '<tr><td colspan="5" class="text-center py-3"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</td></tr>';

        fetch('/api/files/browse?path=' + encodeURIComponent(path))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) { showToast(data.error, 'danger'); return; }

            // Breadcrumb
            if (breadcrumb) {
                var base = '/srv/nas/shares';
                var rel  = data.path.replace(base, '') || '/';
                var parts = rel.split('/').filter(Boolean);
                var html = '<span class="crumb" data-path="' + base + '">shares</span>';
                var acc = base;
                parts.forEach(function(p) {
                    acc += '/' + p;
                    var isCurrent = acc === data.path;
                    html += '<span class="sep">/</span>';
                    html += '<span class="crumb' + (isCurrent ? ' current' : '') + '" data-path="' + acc + '">' + p + '</span>';
                });
                breadcrumb.innerHTML = html;
                breadcrumb.querySelectorAll('.crumb:not(.current)').forEach(function(c) {
                    c.addEventListener('click', function() { loadDirectory(this.dataset.path); });
                });
            }

            // File list
            if (data.entries.length === 0) {
                explorer.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><i class="bi bi-folder2-open me-2"></i>Carpeta vacía</td></tr>';
                return;
            }
            var rows = '';
            data.entries.forEach(function(e) {
                var icon   = e.is_dir ? '<i class="bi bi-folder-fill file-icon dir"></i>' : '<i class="bi bi-file-earmark file-icon file"></i>';
                var size   = e.is_dir ? '—' : formatBytes(e.size);
                var nameEl = e.is_dir
                    ? '<a href="#" class="text-warning fw-semibold entry-dir" data-path="' + e.path + '">' + e.name + '</a>'
                    : '<span>' + e.name + '</span>';
                rows += '<tr>' +
                    '<td class="file-icon">' + icon + '</td>' +
                    '<td>' + nameEl + '</td>' +
                    '<td class="text-muted small">' + size + '</td>' +
                    '<td class="text-muted small">' + e.modified + '</td>' +
                    '<td><button class="btn btn-sm btn-outline-danger py-0 del-entry" data-path="' + e.path + '" data-name="' + e.name + '"><i class="bi bi-trash"></i></button></td>' +
                    '</tr>';
            });
            explorer.innerHTML = rows;

            // Click on directory
            explorer.querySelectorAll('.entry-dir').forEach(function(a) {
                a.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    loadDirectory(this.dataset.path);
                });
            });

            // Delete buttons
            explorer.querySelectorAll('.del-entry').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var p = this.dataset.path;
                    var n = this.dataset.name;
                    document.getElementById('deleteFileName').textContent = n;
                    document.getElementById('deleteFilePath').value = p;
                    var m = getModal('deleteFileModal');
                    if (m) m.show();
                });
            });
        })
        .catch(function() { showToast('Error al cargar el directorio', 'danger'); });
    }

    function formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
        if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
        return (b/1073741824).toFixed(2) + ' GB';
    }

    // Create share
    var createShareBtn = document.getElementById('createShareBtn');
    if (createShareBtn) {
        createShareBtn.addEventListener('click', function() {
            var name   = (document.getElementById('shareName')   ||{}).value.trim();
            var desc   = (document.getElementById('shareDesc')   ||{}).value.trim();
            var pub    = (document.getElementById('sharePublic') ||{}).checked;
            var ro     = (document.getElementById('shareRO')     ||{}).checked;
            if (!name) { showToast('El nombre es obligatorio', 'warning'); return; }
            setLoading(this, true);
            var self = this;
            fetch('/api/shares', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({action:'create', name:name, description:desc, is_public:pub, read_only:ro})
            })
            .then(function(r){return r.json();})
            .then(function(d){
                setLoading(self, false);
                hideModal('createShareModal');
                if (d.success) { showToast('Recurso compartido creado', 'success'); setTimeout(function(){location.reload();}, 1000); }
                else showToast('Error: ' + (d.error||''), 'danger');
            })
            .catch(function(){ setLoading(self, false); showToast('Error de conexión','danger'); });
        });
    }

    // Delete share
    document.querySelectorAll('.delete-share').forEach(function(btn){
        btn.addEventListener('click', function(){
            if (!confirm('¿Eliminar el recurso compartido "' + this.dataset.name + '" y todos sus ficheros?')) return;
            fetch('/api/shares', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({action:'delete', share_id: parseInt(this.dataset.id)})
            })
            .then(function(r){return r.json();})
            .then(function(d){
                if (d.success) { showToast('Recurso eliminado','success'); setTimeout(function(){location.reload();},800); }
                else showToast('Error: '+(d.error||''), 'danger');
            });
        });
    });

    // Backup share
    document.querySelectorAll('.backup-share').forEach(function(btn){
        btn.addEventListener('click', function(){
            document.getElementById('backupShareId').value   = this.dataset.id;
            document.getElementById('backupShareName').textContent = this.dataset.name;
            var m = getModal('backupShareModal');
            if (m) m.show();
        });
    });

    var confirmBackupShareBtn = document.getElementById('confirmBackupShareBtn');
    if (confirmBackupShareBtn) {
        confirmBackupShareBtn.addEventListener('click', function(){
            var id = document.getElementById('backupShareId').value;
            setLoading(this, true);
            var self = this;
            fetch('/api/backup', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({share_id: parseInt(id)})
            })
            .then(function(r){return r.json();})
            .then(function(d){
                setLoading(self, false);
                hideModal('backupShareModal');
                if (d.success) showToast('Backup completado correctamente','success');
                else showToast('Error en backup: '+(d.error||''),'danger');
                setTimeout(function(){location.reload();}, 1500);
            })
            .catch(function(){ setLoading(self, false); showToast('Error de conexión','danger'); });
        });
    }

    // Open/close mkdir modal
    var openMkdirBtn = document.getElementById('openMkdirBtn');
    if (openMkdirBtn) {
        openMkdirBtn.addEventListener('click', function(){
            if (!currentBrowsePath) { showToast('Selecciona un recurso compartido primero','warning'); return; }
            var inp = document.getElementById('newFolderName');
            if (inp) inp.value = '';
            var m = getModal('mkdirModal');
            if (m) m.show();
        });
    }

    // Create folder
    var mkdirBtn = document.getElementById('mkdirBtn');
    if (mkdirBtn) {
        mkdirBtn.addEventListener('click', function(){
            var name = (document.getElementById('newFolderName')||{}).value.trim();
            if (!name || !currentBrowsePath) { showToast('Introduce un nombre','warning'); return; }
            setLoading(this, true);
            var self = this;
            fetch('/api/files/mkdir', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({path: currentBrowsePath + '/' + name})
            })
            .then(function(r){return r.json();})
            .then(function(d){
                setLoading(self, false);
                hideModal('mkdirModal');
                if (d.success) { showToast('Carpeta creada','success'); loadDirectory(currentBrowsePath); }
                else showToast('Error: '+(d.error||''),'danger');
            })
            .catch(function(){ setLoading(self, false); showToast('Error de conexión','danger'); });
        });
    }

    // Delete file/folder
    var confirmDeleteFileBtn = document.getElementById('confirmDeleteFileBtn');
    if (confirmDeleteFileBtn) {
        confirmDeleteFileBtn.addEventListener('click', function(){
            var path = (document.getElementById('deleteFilePath')||{}).value;
            setLoading(this, true);
            var self = this;
            fetch('/api/files/delete', {
                method:'DELETE', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({path: path})
            })
            .then(function(r){return r.json();})
            .then(function(d){
                setLoading(self, false);
                hideModal('deleteFileModal');
                if (d.success) { showToast('Eliminado correctamente','success'); loadDirectory(currentBrowsePath); }
                else showToast('Error: '+(d.error||''),'danger');
            })
            .catch(function(){ setLoading(self, false); showToast('Error de conexión','danger'); });
        });
    }

    // Toggle upload zone
    var openUploadBtn = document.getElementById('openUploadBtn');
    var closeUploadBtn = document.getElementById('closeUploadBtn');
    var uploadZone = document.getElementById('uploadZone');
    if (openUploadBtn) {
        openUploadBtn.addEventListener('click', function(){
            if (!currentBrowsePath) { showToast('Selecciona un recurso compartido primero','warning'); return; }
            if (uploadZone) uploadZone.classList.toggle('d-none');
        });
    }
    if (closeUploadBtn) {
        closeUploadBtn.addEventListener('click', function(){
            if (uploadZone) uploadZone.classList.add('d-none');
        });
    }

    // Upload file
    var uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(ev){
            ev.preventDefault();
            if (!currentBrowsePath) { showToast('Selecciona una carpeta primero','warning'); return; }
            var fd = new FormData(this);
            fd.set('path', currentBrowsePath);
            var btn = this.querySelector('button[type=submit]');
            setLoading(btn, true);
            fetch('/api/files/upload', { method:'POST', body: fd })
            .then(function(r){return r.json();})
            .then(function(d){
                setLoading(btn, false);
                if (d.success) {
                    showToast('Archivo subido correctamente','success');
                    loadDirectory(currentBrowsePath);
                    uploadForm.reset();
                    if (uploadZone) uploadZone.classList.add('d-none');
                }
                else showToast('Error: '+(d.error||''),'danger');
            })
            .catch(function(){ setLoading(btn, false); showToast('Error de conexión','danger'); });
        });
    }

}); // end DOMContentLoaded
