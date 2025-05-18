"""
Create test user for demo
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.auth.models import User, Base
from src.auth.security import PasswordManager
from src.auth.database import engine, SessionLocal
from sqlalchemy.orm import Session

def create_test_user():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Create session
    db: Session = SessionLocal()
    
    try:
        # Check if test user already exists
        existing_user = db.query(User).filter(User.email == "demo@example.com").first()
        if existing_user:
            print("Test user already exists")
            return
        
        # Create password manager
        password_manager = PasswordManager()
        
        # Create test user
        test_user = User(
            email="demo@example.com",
            hashed_password=password_manager.get_password_hash("demo1234"),
            full_name="Demo User",
            is_active=True,
            is_superuser=False
        )
        
        db.add(test_user)
        db.commit()
        
        print("Test user created successfully!")
        print("Email: demo@example.com")
        print("Password: demo1234")
        
    except Exception as e:
        print(f"Error creating test user: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()