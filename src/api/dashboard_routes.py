"""
ダッシュボード保存・管理・共有機能のためのAPIエンドポイント
Dashboard Save, Management and Sharing API Endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import hashlib
import secrets
from pydantic import BaseModel, Field
import asyncpg
import json
import os
from urllib.parse import quote

router = APIRouter(prefix="/api/v2/dashboards", tags=["dashboards"])

# Pydanticモデル定義
class DashboardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    config: Dict[str, Any] = Field(..., description="ダッシュボードの設定情報（レイアウト、ウィジェット等）")
    tags: List[str] = Field(default_factory=list)
    visibility: str = Field(default="private", pattern="^(public|private|limited)$")
    password: Optional[str] = None
    template_category: Optional[str] = None

class DashboardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = Field(None, pattern="^(public|private|limited)$")
    password: Optional[str] = None

class DashboardResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    config: Dict[str, Any]
    tags: List[str]
    visibility: str
    share_token: Optional[str]
    share_expires_at: Optional[datetime]
    access_count: int
    unique_visitors: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    last_accessed_at: Optional[datetime]
    is_template: bool
    template_category: Optional[str]
    version: int
    is_favorite: Optional[bool] = None

class ShareTokenCreate(BaseModel):
    expires_in_days: Optional[int] = Field(default=30, ge=1, le=365)
    password: Optional[str] = None

class ShareTokenResponse(BaseModel):
    share_token: str
    share_url: str
    expires_at: Optional[datetime]

class DashboardComment(BaseModel):
    comment: str = Field(..., min_length=1)
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    widget_id: Optional[str] = None
    parent_comment_id: Optional[str] = None

class DashboardCommentResponse(BaseModel):
    id: str
    comment: str
    position_x: Optional[float]
    position_y: Optional[float]
    widget_id: Optional[str]
    parent_comment_id: Optional[str]
    user_id: str
    created_at: datetime
    updated_at: datetime
    is_resolved: bool

# データベース接続の依存性（実際の実装では適切なDB接続を使用）
async def get_db_connection():
    # TODO: 実際のデータベース接続設定
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/conea")
    return await asyncpg.connect(DATABASE_URL)

# 現在のユーザーID取得の依存性（実際の認証システムと統合）
async def get_current_user_id() -> str:
    # TODO: 実際の認証システムから取得
    return "00000000-0000-0000-0000-000000000001"

# パスワードハッシュ化関数
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# 共有URL生成関数
def generate_share_url(share_token: str) -> str:
    base_url = os.getenv("FRONTEND_URL", "https://stagingapp.conea.ai")
    return f"{base_url}/public/dashboard/{share_token}"

@router.post("/", response_model=DashboardResponse)
async def create_dashboard(
    dashboard: DashboardCreate,
    user_id: str = Depends(get_current_user_id)
):
    """新しいダッシュボードを作成"""
    conn = await get_db_connection()
    try:
        dashboard_id = str(uuid.uuid4())
        password_hash = hash_password(dashboard.password) if dashboard.password else None
        
        query = """
        INSERT INTO dashboards (
            id, name, description, config, tags, visibility, 
            password_hash, created_by, template_category
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        """
        
        row = await conn.fetchrow(
            query, dashboard_id, dashboard.name, dashboard.description,
            json.dumps(dashboard.config), dashboard.tags, dashboard.visibility,
            password_hash, user_id, dashboard.template_category
        )
        
        # 初期バージョンを作成
        await conn.execute(
            """
            INSERT INTO dashboard_versions (dashboard_id, version_number, config, created_by)
            VALUES ($1, $2, $3, $4)
            """,
            dashboard_id, 1, json.dumps(dashboard.config), user_id
        )
        
        return DashboardResponse(
            id=str(row['id']),
            name=row['name'],
            description=row['description'],
            config=json.loads(row['config']),
            tags=row['tags'],
            visibility=row['visibility'],
            share_token=str(row['share_token']) if row['share_token'] else None,
            share_expires_at=row['share_expires_at'],
            access_count=row['access_count'],
            unique_visitors=row['unique_visitors'],
            created_by=str(row['created_by']),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_accessed_at=row['last_accessed_at'],
            is_template=row['is_template'],
            template_category=row['template_category'],
            version=row['version']
        )
    finally:
        await conn.close()

@router.get("/", response_model=List[DashboardResponse])
async def list_dashboards(
    user_id: str = Depends(get_current_user_id),
    tags: Optional[List[str]] = Query(None),
    visibility: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_template: Optional[bool] = Query(None),
    template_category: Optional[str] = Query(None),
    sort_by: str = Query("created_at", regex="^(created_at|updated_at|name|access_count)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """ダッシュボード一覧を取得"""
    conn = await get_db_connection()
    try:
        conditions = ["(d.created_by = $1 OR d.visibility = 'public')"]
        params = [user_id]
        param_count = 1
        
        if tags:
            param_count += 1
            conditions.append(f"d.tags && ${param_count}")
            params.append(tags)
        
        if visibility:
            param_count += 1
            conditions.append(f"d.visibility = ${param_count}")
            params.append(visibility)
        
        if search:
            param_count += 1
            conditions.append(f"(d.name ILIKE ${param_count} OR d.description ILIKE ${param_count})")
            params.append(f"%{search}%")
        
        if is_template is not None:
            param_count += 1
            conditions.append(f"d.is_template = ${param_count}")
            params.append(is_template)
        
        if template_category:
            param_count += 1
            conditions.append(f"d.template_category = ${param_count}")
            params.append(template_category)
        
        query = f"""
        SELECT d.*, 
               CASE WHEN f.dashboard_id IS NOT NULL THEN true ELSE false END as is_favorite
        FROM dashboards d
        LEFT JOIN dashboard_favorites f ON d.id = f.dashboard_id AND f.user_id = $1
        WHERE {' AND '.join(conditions)}
        ORDER BY d.{sort_by} {sort_order.upper()}
        LIMIT ${param_count + 1} OFFSET ${param_count + 2}
        """
        params.extend([limit, offset])
        
        rows = await conn.fetch(query, *params)
        
        dashboards = []
        for row in rows:
            dashboards.append(DashboardResponse(
                id=str(row['id']),
                name=row['name'],
                description=row['description'],
                config=json.loads(row['config']),
                tags=row['tags'],
                visibility=row['visibility'],
                share_token=str(row['share_token']) if row['share_token'] else None,
                share_expires_at=row['share_expires_at'],
                access_count=row['access_count'],
                unique_visitors=row['unique_visitors'],
                created_by=str(row['created_by']),
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                last_accessed_at=row['last_accessed_at'],
                is_template=row['is_template'],
                template_category=row['template_category'],
                version=row['version'],
                is_favorite=row['is_favorite']
            ))
        
        return dashboards
    finally:
        await conn.close()

@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    user_id: str = Depends(get_current_user_id),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """特定のダッシュボードを取得"""
    conn = await get_db_connection()
    try:
        query = """
        SELECT d.*, 
               CASE WHEN f.dashboard_id IS NOT NULL THEN true ELSE false END as is_favorite
        FROM dashboards d
        LEFT JOIN dashboard_favorites f ON d.id = f.dashboard_id AND f.user_id = $2
        WHERE d.id = $1 AND (d.created_by = $2 OR d.visibility IN ('public', 'limited'))
        """
        
        row = await conn.fetchrow(query, dashboard_id, user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # アクセスログの記録をバックグラウンドタスクで実行
        background_tasks.add_task(log_dashboard_access, dashboard_id, user_id, "view")
        
        return DashboardResponse(
            id=str(row['id']),
            name=row['name'],
            description=row['description'],
            config=json.loads(row['config']),
            tags=row['tags'],
            visibility=row['visibility'],
            share_token=str(row['share_token']) if row['share_token'] else None,
            share_expires_at=row['share_expires_at'],
            access_count=row['access_count'],
            unique_visitors=row['unique_visitors'],
            created_by=str(row['created_by']),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_accessed_at=row['last_accessed_at'],
            is_template=row['is_template'],
            template_category=row['template_category'],
            version=row['version'],
            is_favorite=row['is_favorite']
        )
    finally:
        await conn.close()

@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard: DashboardUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """ダッシュボードを更新"""
    conn = await get_db_connection()
    try:
        # 所有者確認
        existing = await conn.fetchrow(
            "SELECT * FROM dashboards WHERE id = $1 AND created_by = $2",
            dashboard_id, user_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Dashboard not found or access denied")
        
        # 更新フィールドの準備
        update_fields = []
        params = []
        param_count = 0
        
        if dashboard.name is not None:
            param_count += 1
            update_fields.append(f"name = ${param_count}")
            params.append(dashboard.name)
        
        if dashboard.description is not None:
            param_count += 1
            update_fields.append(f"description = ${param_count}")
            params.append(dashboard.description)
        
        if dashboard.config is not None:
            param_count += 1
            update_fields.append(f"config = ${param_count}")
            params.append(json.dumps(dashboard.config))
            
            # 新しいバージョンを作成
            new_version = existing['version'] + 1
            param_count += 1
            update_fields.append(f"version = ${param_count}")
            params.append(new_version)
            
            # バージョン履歴に追加
            await conn.execute(
                """
                INSERT INTO dashboard_versions (dashboard_id, version_number, config, created_by)
                VALUES ($1, $2, $3, $4)
                """,
                dashboard_id, new_version, json.dumps(dashboard.config), user_id
            )
        
        if dashboard.tags is not None:
            param_count += 1
            update_fields.append(f"tags = ${param_count}")
            params.append(dashboard.tags)
        
        if dashboard.visibility is not None:
            param_count += 1
            update_fields.append(f"visibility = ${param_count}")
            params.append(dashboard.visibility)
        
        if dashboard.password is not None:
            param_count += 1
            update_fields.append(f"password_hash = ${param_count}")
            params.append(hash_password(dashboard.password))
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.extend([dashboard_id, user_id])
        query = f"""
        UPDATE dashboards 
        SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${param_count + 1} AND created_by = ${param_count + 2}
        RETURNING *
        """
        
        row = await conn.fetchrow(query, *params)
        
        return DashboardResponse(
            id=str(row['id']),
            name=row['name'],
            description=row['description'],
            config=json.loads(row['config']),
            tags=row['tags'],
            visibility=row['visibility'],
            share_token=str(row['share_token']) if row['share_token'] else None,
            share_expires_at=row['share_expires_at'],
            access_count=row['access_count'],
            unique_visitors=row['unique_visitors'],
            created_by=str(row['created_by']),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_accessed_at=row['last_accessed_at'],
            is_template=row['is_template'],
            template_category=row['template_category'],
            version=row['version']
        )
    finally:
        await conn.close()

@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """ダッシュボードを削除"""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "DELETE FROM dashboards WHERE id = $1 AND created_by = $2",
            dashboard_id, user_id
        )
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Dashboard not found or access denied")
        
        return {"message": "Dashboard deleted successfully"}
    finally:
        await conn.close()

@router.post("/{dashboard_id}/share", response_model=ShareTokenResponse)
async def create_share_token(
    dashboard_id: str,
    share_data: ShareTokenCreate,
    user_id: str = Depends(get_current_user_id)
):
    """共有トークンを生成"""
    conn = await get_db_connection()
    try:
        # 所有者確認
        dashboard = await conn.fetchrow(
            "SELECT * FROM dashboards WHERE id = $1 AND created_by = $2",
            dashboard_id, user_id
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found or access denied")
        
        share_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=share_data.expires_in_days) if share_data.expires_in_days else None
        password_hash = hash_password(share_data.password) if share_data.password else None
        
        await conn.execute(
            """
            UPDATE dashboards 
            SET share_token = $1, share_expires_at = $2, password_hash = $3
            WHERE id = $4
            """,
            share_token, expires_at, password_hash, dashboard_id
        )
        
        share_url = generate_share_url(share_token)
        
        return ShareTokenResponse(
            share_token=share_token,
            share_url=share_url,
            expires_at=expires_at
        )
    finally:
        await conn.close()

@router.delete("/{dashboard_id}/share")
async def revoke_share_token(
    dashboard_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """共有トークンを無効化"""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            """
            UPDATE dashboards 
            SET share_token = NULL, share_expires_at = NULL
            WHERE id = $1 AND created_by = $2
            """,
            dashboard_id, user_id
        )
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Dashboard not found or access denied")
        
        return {"message": "Share token revoked successfully"}
    finally:
        await conn.close()

@router.get("/public/{share_token}", response_model=DashboardResponse)
async def get_public_dashboard(
    share_token: str,
    password: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """共有トークンでダッシュボードを取得（認証不要）"""
    conn = await get_db_connection()
    try:
        query = """
        SELECT * FROM dashboards 
        WHERE share_token = $1 
        AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP)
        """
        
        row = await conn.fetchrow(query, share_token)
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard not found or link expired")
        
        # パスワード保護の確認
        if row['password_hash'] and (not password or hash_password(password) != row['password_hash']):
            raise HTTPException(status_code=401, detail="Password required")
        
        # アクセスログの記録をバックグラウンドタスクで実行
        background_tasks.add_task(log_dashboard_access, str(row['id']), None, "view")
        
        return DashboardResponse(
            id=str(row['id']),
            name=row['name'],
            description=row['description'],
            config=json.loads(row['config']),
            tags=row['tags'],
            visibility=row['visibility'],
            share_token=str(row['share_token']) if row['share_token'] else None,
            share_expires_at=row['share_expires_at'],
            access_count=row['access_count'],
            unique_visitors=row['unique_visitors'],
            created_by=str(row['created_by']),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_accessed_at=row['last_accessed_at'],
            is_template=row['is_template'],
            template_category=row['template_category'],
            version=row['version']
        )
    finally:
        await conn.close()

@router.post("/{dashboard_id}/favorite")
async def toggle_favorite(
    dashboard_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """お気に入りの切り替え"""
    conn = await get_db_connection()
    try:
        # 既存のお気に入りを確認
        existing = await conn.fetchrow(
            "SELECT id FROM dashboard_favorites WHERE dashboard_id = $1 AND user_id = $2",
            dashboard_id, user_id
        )
        
        if existing:
            # お気に入りを削除
            await conn.execute(
                "DELETE FROM dashboard_favorites WHERE dashboard_id = $1 AND user_id = $2",
                dashboard_id, user_id
            )
            return {"message": "Removed from favorites", "is_favorite": False}
        else:
            # お気に入りに追加
            await conn.execute(
                "INSERT INTO dashboard_favorites (dashboard_id, user_id) VALUES ($1, $2)",
                dashboard_id, user_id
            )
            return {"message": "Added to favorites", "is_favorite": True}
    finally:
        await conn.close()

@router.get("/{dashboard_id}/comments", response_model=List[DashboardCommentResponse])
async def get_dashboard_comments(
    dashboard_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """ダッシュボードのコメント一覧を取得"""
    conn = await get_db_connection()
    try:
        query = """
        SELECT * FROM dashboard_comments 
        WHERE dashboard_id = $1 
        ORDER BY created_at ASC
        """
        
        rows = await conn.fetch(query, dashboard_id)
        
        comments = []
        for row in rows:
            comments.append(DashboardCommentResponse(
                id=str(row['id']),
                comment=row['comment'],
                position_x=row['position_x'],
                position_y=row['position_y'],
                widget_id=row['widget_id'],
                parent_comment_id=str(row['parent_comment_id']) if row['parent_comment_id'] else None,
                user_id=str(row['user_id']),
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                is_resolved=row['is_resolved']
            ))
        
        return comments
    finally:
        await conn.close()

@router.post("/{dashboard_id}/comments", response_model=DashboardCommentResponse)
async def create_dashboard_comment(
    dashboard_id: str,
    comment: DashboardComment,
    user_id: str = Depends(get_current_user_id)
):
    """ダッシュボードにコメントを追加"""
    conn = await get_db_connection()
    try:
        comment_id = str(uuid.uuid4())
        
        query = """
        INSERT INTO dashboard_comments (
            id, dashboard_id, user_id, comment, position_x, position_y,
            widget_id, parent_comment_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """
        
        row = await conn.fetchrow(
            query, comment_id, dashboard_id, user_id, comment.comment,
            comment.position_x, comment.position_y, comment.widget_id,
            comment.parent_comment_id
        )
        
        return DashboardCommentResponse(
            id=str(row['id']),
            comment=row['comment'],
            position_x=row['position_x'],
            position_y=row['position_y'],
            widget_id=row['widget_id'],
            parent_comment_id=str(row['parent_comment_id']) if row['parent_comment_id'] else None,
            user_id=str(row['user_id']),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            is_resolved=row['is_resolved']
        )
    finally:
        await conn.close()

async def log_dashboard_access(dashboard_id: str, user_id: Optional[str], access_type: str):
    """ダッシュボードアクセスログを記録（バックグラウンドタスク）"""
    conn = await get_db_connection()
    try:
        # アクセスログを追加
        await conn.execute(
            """
            INSERT INTO dashboard_access_logs (dashboard_id, user_id, access_type)
            VALUES ($1, $2, $3)
            """,
            dashboard_id, user_id, access_type
        )
        
        # アクセス数と最終アクセス時刻を更新
        await conn.execute(
            """
            UPDATE dashboards 
            SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
            WHERE id = $1
            """,
            dashboard_id
        )
    finally:
        await conn.close()