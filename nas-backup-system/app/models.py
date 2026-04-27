from app import db, login
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

# Association table for User <-> Group
user_groups = db.Table('user_groups',
    db.Column('user_id',  db.Integer, db.ForeignKey('user.id'),  primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('group.id'), primary_key=True)
)

class User(UserMixin, db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin      = db.Column(db.Boolean, default=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

class Group(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255), default='')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    members     = db.relationship('User', secondary=user_groups, backref='groups')

class Backup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_ip = db.Column(db.String(45), nullable=False)
    client_name = db.Column(db.String(100), nullable=False)
    backup_path = db.Column(db.String(500), nullable=False)
    size = db.Column(db.BigInteger, default=0)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Raid(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    level = db.Column(db.String(10), nullable=False)
    devices = db.Column(db.Text, nullable=False)  # JSON
    status = db.Column(db.String(20), default='active')
    size = db.Column(db.BigInteger, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Share(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(80), unique=True, nullable=False)
    path        = db.Column(db.String(500), nullable=False)
    description = db.Column(db.String(255), default='')
    is_public   = db.Column(db.Boolean, default=False)
    read_only   = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)