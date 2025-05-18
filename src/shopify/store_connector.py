"""Manage connections to multiple Shopify stores."""

import logging
from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from src.auth import models

logger = logging.getLogger(__name__)


class StoreConnector:
    """Handle ShopifyStore records for organizations."""

    def __init__(self, db: Session):
        self.db = db

    def add_store(self, organization_id: UUID, shop_url: str, api_key: str,
                  api_secret_key: str, access_token: str,
                  api_version: str = "2024-10") -> models.ShopifyStore:
        store = models.ShopifyStore(
            organization_id=organization_id,
            shop_url=shop_url,
            api_key=api_key,
            api_secret_key=api_secret_key,
            access_token=access_token,
            api_version=api_version,
        )
        self.db.add(store)
        self.db.commit()
        self.db.refresh(store)
        return store

    def list_stores(self, organization_id: UUID) -> List[models.ShopifyStore]:
        return self.db.query(models.ShopifyStore).filter(
            models.ShopifyStore.organization_id == organization_id
        ).all()

    def get_store(self, store_id: UUID) -> Optional[models.ShopifyStore]:
        return self.db.query(models.ShopifyStore).filter(
            models.ShopifyStore.id == store_id
        ).first()
