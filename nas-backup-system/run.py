#!/usr/bin/env python3
from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    db.create_all()
    # Crear admin por defecto si no existe
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', email='admin@nas.local', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("✅ Usuario admin creado: admin / admin123")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)