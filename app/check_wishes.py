from app import app, db
from models import Wish

with app.app_context():
    wishes = Wish.query.all()
    for wish in wishes:
        print(f'Wish ID: {wish.id}, Name: {wish.name}, Icon: {wish.icon}')
