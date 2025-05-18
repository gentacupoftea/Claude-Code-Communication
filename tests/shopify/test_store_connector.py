"""Tests for StoreConnector and APIKeyManager."""

from uuid import uuid4
from cryptography.fernet import Fernet

from src.shopify.store_connector import StoreConnector
from src.shopify.api_key_manager import APIKeyManager
from src.auth import models


async def test_add_store(db_session, test_organization):
    connector = StoreConnector(db_session)
    store = connector.add_store(
        organization_id=test_organization.id,
        shop_url="example.myshopify.com",
        api_key="key",
        api_secret_key="secret",
        access_token="token",
    )
    assert store.id is not None
    stores = connector.list_stores(test_organization.id)
    assert len(stores) == 1


def test_api_key_manager_encrypt_decrypt():
    secret = Fernet.generate_key()
    manager = APIKeyManager(secret)
    value = "mytoken"
    enc = manager.encrypt(value)
    assert enc != value
    dec = manager.decrypt(enc)
    assert dec == value
