"""
Create test user directly with SQL
"""
import sqlite3
import uuid
from datetime import datetime
from passlib.context import CryptContext

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Database connection
conn = sqlite3.connect('shopify_mcp.db')
cursor = conn.cursor()

# Create users table if it doesn't exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_superuser BOOLEAN DEFAULT 0,
    created_at TIMESTAMP,
    last_login TIMESTAMP
)
''')

# Create test user
user_id = str(uuid.uuid4())
email = "demo@example.com"
password = "demo1234"
hashed_password = pwd_context.hash(password)
full_name = "Demo User"
created_at = datetime.utcnow().isoformat()

try:
    cursor.execute('''
    INSERT INTO users (id, email, hashed_password, full_name, is_active, is_superuser, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, email, hashed_password, full_name, True, False, created_at))
    
    conn.commit()
    print("Test user created successfully!")
    print(f"Email: {email}")
    print(f"Password: {password}")
    
except sqlite3.IntegrityError:
    print("Test user already exists")
    
finally:
    conn.close()