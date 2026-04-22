#!/usr/bin/env python3
from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    db.create_all()
    # Crear usuario root por defecto si no existe ningún admin
    if not User.query.filter_by(username='root').first():
        root = User(username='root', email='root@nas.local', is_admin=True)
        root.set_password('root')
        db.session.add(root)
        db.session.commit()
        print("✅ Usuario root creado: root / root")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
