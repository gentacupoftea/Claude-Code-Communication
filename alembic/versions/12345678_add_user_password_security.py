"""add_user_password_security

Revision ID: 12345678_add_user_password_security
Revises: 0a028402f5f9
Create Date: 2025-06-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '12345678_add_user_password_security'
down_revision: Union[str, None] = '0a028402f5f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add password reset and security lockout fields to users table."""
    
    # パスワードリセット機能のフィールドを追加
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('password_reset_expires', sa.TIMESTAMP(timezone=True), nullable=True))
    
    # ログイン試行管理とアカウントロック機能のフィールドを追加
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('locked_until', sa.TIMESTAMP(timezone=True), nullable=True))
    
    # パスワードリセットトークンのユニークインデックスを作成（nullでない場合のみ）
    op.create_index(
        'idx_users_password_reset_token_unique', 
        'users', 
        ['password_reset_token'], 
        unique=True, 
        postgresql_where=sa.text('password_reset_token IS NOT NULL')
    )
    
    # ロックされたユーザーを効率的に検索するためのインデックス
    op.create_index(
        'idx_users_locked_until', 
        'users', 
        ['locked_until'], 
        postgresql_where=sa.text('locked_until IS NOT NULL')
    )
    
    # ログイン試行回数でのインデックス（セキュリティ監視用）
    op.create_index(
        'idx_users_failed_login_attempts', 
        'users', 
        ['failed_login_attempts'], 
        postgresql_where=sa.text('failed_login_attempts > 0')
    )


def downgrade() -> None:
    """Downgrade schema - Remove password reset and security lockout fields from users table."""
    
    # インデックスの削除
    op.drop_index('idx_users_failed_login_attempts', 'users')
    op.drop_index('idx_users_locked_until', 'users')
    op.drop_index('idx_users_password_reset_token_unique', 'users')
    
    # カラムの削除
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'password_reset_expires')
    op.drop_column('users', 'password_reset_token')