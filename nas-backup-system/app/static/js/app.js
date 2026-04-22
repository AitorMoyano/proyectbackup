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
                    showToast('Backup iniciado para ' + pendingBackupName, 'success');
                    setTimeout(function () { location.reload(); }, 1500);
                } else {
                    showToast('Error: ' + (data.error || 'No se pudo crear el backup'), 'danger');
                }
            })
            .catch(function () { showToast('Error de conexión con el servidor', 'danger'); })
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
                }
            })
            .catch(function () { showToast('Error de conexión', 'danger'); })
            .finally(function () { setLoading(self, false); });
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

}); // end DOMContentLoaded
