"""Add email verification and security features

Revision ID: email_verification_001
Revises: 
Create Date: 2024-01-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'email_verification_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add email verification fields
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('email_verification_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('email_verification_sent_at', sa.DateTime(), nullable=True))
    
    # Add account lockout fields
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('account_locked_until', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_failed_login_at', sa.DateTime(), nullable=True))
    
    # Add 2FA fields
    op.add_column('users', sa.Column('two_factor_secret', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('backup_codes', sa.JSON(), nullable=True))
    
    # Create user_sessions table
    op.create_table('user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('device_info', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_active_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('idx_user_sessions_token_hash', 'user_sessions', ['token_hash'])
    
    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_logs_organization_id', 'audit_logs', ['organization_id'])
    op.create_index('idx_audit_logs_created_at', 'audit_logs', ['created_at'])
    
    # Create password_history table
    op.create_table('password_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_password_history_user_id', 'password_history', ['user_id'])


def downgrade():
    # Drop tables
    op.drop_table('password_history')
    op.drop_table('audit_logs')
    op.drop_table('user_sessions')
    
    # Remove columns from users table
    op.drop_column('users', 'backup_codes')
    op.drop_column('users', 'two_factor_enabled')
    op.drop_column('users', 'two_factor_secret')
    op.drop_column('users', 'last_failed_login_at')
    op.drop_column('users', 'account_locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'email_verification_sent_at')
    op.drop_column('users', 'email_verification_token')
    op.drop_column('users', 'email_verified')