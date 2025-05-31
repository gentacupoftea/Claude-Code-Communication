"""
Create a new test user using the same auth service as the app
"""
import sys
sys.path.append('.')

from src.auth.models import User
from src.auth.security import PasswordManager
from src.auth.database import SessionLocal
import uuid

def create_test_user():
    db = SessionLocal()
    password_manager = PasswordManager()
    
    try:
        # Delete existing test user
        existing = db.query(User).filter(User.email == "test@example.com").first()
        if existing:
            db.delete(existing)
            db.commit()
        
        # Create new test user
        new_user = User(
            id=uuid.uuid4(),
            email="test@example.com",
            hashed_password=password_manager.get_password_hash("test1234"),
            full_name="Test User",
            is_active=True,
            is_superuser=False
        )
        
        db.add(new_user)
        db.commit()
        
        print("New test user created!")
        print("Email: test@example.com")
        print("Password: test1234")
        
        # Test the password
        stored_user = db.query(User).filter(User.email == "test@example.com").first()
        if password_manager.verify_password("test1234", stored_user.hashed_password):
            print("Password verification: SUCCESS")
        else:
            print("Password verification: FAILED")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()