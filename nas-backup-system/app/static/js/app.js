// Gestión de Backups
document.addEventListener('DOMContentLoaded', function() {
    // Botones de backup
    document.querySelectorAll('.backup-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const ip = this.dataset.ip;
            const name = this.dataset.name;
            
            if (confirm(`¿Crear backup de ${name} (${ip})?`)) {
                fetch('/api/backup', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({client_ip: ip, client_name: name, share: 'backup'})
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert('✅ Backup creado exitosamente');
                        location.reload();
                    } else {
                        alert('❌ Error: ' + data.error);
                    }
                });
            }
        });
    });

    // Botones de restaurar
    document.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const backupId = this.dataset.id;
            const target = prompt('Ruta de destino para restaurar:');
            if (target) {
                fetch(`/api/restore/${backupId}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({target: target})
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert('✅ Restauración completada');
                        location.reload();
                    } else {
                        alert('❌ Error: ' + data.error);
                    }
                });
            }
        });
    });

    // Crear RAID
    document.getElementById('create-raid')?.addEventListener('click', function() {
        const level = document.getElementById('raid-level').value;
        const devices = Array.from(document.querySelectorAll('input[name="raid-devices"]:checked')).map(cb => cb.value);
        
        if (devices.length < 2) {
            alert('Selecciona al menos 2 discos');
            return;
        }
        
        if (confirm(`¿Crear RAID ${level} con ${devices.length} discos? ESTO BORRARÁ LOS DATOS`)) {
            fetch('/api/raid/create', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({level: level, devices: devices})
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert('✅ RAID creado');
                    location.reload();
                } else {
                    alert('❌ Error: ' + data.error);
                }
            });
        }
    });

    // Gestión usuarios
    document.getElementById('create-user')?.addEventListener('click', function() {
        const formData = {
            action: 'create',
            username: document.getElementById('new-username').value,
            email: document.getElementById('new-email').value,
            password: document.getElementById('new-password').value,
            is_admin: document.getElementById('new-is-admin').checked
        };
        
        fetch('/api/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('✅ Usuario creado');
                location.reload();
            } else {
                alert('❌ Error: ' + data.error);
            }
        });
    });

    // Eliminar backup (solo admin)
    document.querySelectorAll('.delete-backup').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('¿Eliminar este backup PERMANENTEMENTE?')) {
                const backupId = this.dataset.id;
                fetch(`/api/backup/${backupId}/delete`, {
                    method: 'DELETE'
                })
                .then(() => {
                    location.reload();
                });
            }
        });
    });

    // Eliminar usuario (solo admin)
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('¿Eliminar este usuario?')) {
                const userId = this.dataset.id;
                fetch(`/api/users/${userId}/delete`, {
                    method: 'DELETE'
                })
                .then(() => {
                    location.reload();
                });
            }
        });
    });
});