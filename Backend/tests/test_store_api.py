import pytest
from pwdlib import PasswordHash
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import Product
from app.seed_catalog import seed_catalog


def customer(state="Tamil Nadu"):
    return {
        "name": "Test Customer",
        "phone": "9876543210",
        "address": "12 Example Street, Sivakasi",
        "city": "Sivakasi",
        "state": state,
        "pincode": "626123",
    }


def test_catalog_filters_and_sorting(client):
    response = client.get("/api/v1/products", params={"category": "Flower Pots", "q": "flower", "sort": "high"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [2]
    detail = client.get("/api/v1/products/2")
    assert detail.status_code == 200
    assert detail.json() == {
        "id": 2,
        "name": "Flower Pot",
        "category": "Flower Pots",
        "mrp": 4000,
        "price": 3600,
        "pack_unit": "Box",
        "pieces": "10",
        "description": None,
        "image_url": None,
        "stock_quantity": 0,
    }
    assert client.get("/api/v1/products/999").status_code == 404
    assert client.get("/api/v1/categories").json() == ["Sound Crackers", "Flower Pots"]


def test_order_uses_database_prices_and_stores_snapshots(client):
    response = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 2, "quantity": 1}]},
    )
    assert response.status_code == 201
    order = response.json()
    assert order["subtotal"] == 3600
    assert order["delivery_fee"] == 0
    assert order["total"] == 3600
    assert order["user_category"] == "guest"
    assert order["items"][0]["name"] == "Flower Pot"
    assert order["items"][0]["price"] == 3600
    assert order["items"][0]["quantity"] == 1


def test_state_minimums_and_payment_method_are_enforced(client):
    below_tamil_nadu_minimum = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 1, "quantity": 33}]},
    )
    below_interstate_minimum = client.post(
        "/api/v1/orders",
        json={"customer": customer("Karnataka"), "payment_method": "cod", "items": [{"product_id": 2, "quantity": 1}]},
    )
    unsupported_payment = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "upi", "items": [{"product_id": 2, "quantity": 1}]},
    )
    assert below_tamil_nadu_minimum.status_code == 422
    assert "3000" in below_tamil_nadu_minimum.json()["detail"]
    assert below_interstate_minimum.status_code == 422
    assert "5000" in below_interstate_minimum.json()["detail"]
    assert unsupported_payment.status_code == 422


def test_rejects_unavailable_product_and_bad_quantity(client):
    unavailable = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 999, "quantity": 40}]},
    )
    invalid_quantity = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 1, "quantity": 0}]},
    )
    assert unavailable.status_code == 422
    assert invalid_quantity.status_code == 422


def test_admin_session_login_me_and_logout(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_phone", "9876543210")
    monkeypatch.setattr(settings, "admin_password_hash", PasswordHash.recommended().hash("A-Secure-Admin-Password"))

    login = client.post("/api/v1/auth/login", json={"phone": "9876543210", "password": "A-Secure-Admin-Password"})
    assert login.status_code == 200
    assert "httponly" in login.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").json() == {"name": settings.admin_name, "phone": "9876543210"}

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_login_rejects_invalid_credentials(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_phone", "9876543210")
    monkeypatch.setattr(settings, "admin_password_hash", PasswordHash.recommended().hash("A-Secure-Admin-Password"))

    response = client.post("/api/v1/auth/login", json={"phone": "9876543210", "password": "wrong-password"})
    assert response.status_code == 401


def registration_payload():
    return {
        "name": "Sample Customer",
        "email": "sample@example.com",
        "mobile": "9876543210",
        "address_line1": "12 Market Road",
        "address_line2": "Near Clock Tower",
        "pincode": "626123",
        "password": "A-Long-Customer-Password",
    }


def configure_admin(client, monkeypatch):
    monkeypatch.setattr(settings, "admin_phone", "9876500000")
    monkeypatch.setattr(settings, "admin_password_hash", PasswordHash.recommended().hash("A-Secure-Admin-Password"))
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "9876500000", "password": "A-Secure-Admin-Password"},
    )
    assert response.status_code == 200


def test_customer_registration_login_and_logout(client):
    registration = client.post("/api/v1/customer/auth/register", json=registration_payload())
    assert registration.status_code == 201
    assert "httponly" in registration.headers["set-cookie"].lower()
    assert "password" not in registration.json()["user"]
    assert client.get("/api/v1/customer/auth/me").json()["email"] == "sample@example.com"

    assert client.post("/api/v1/customer/auth/logout").status_code == 204
    assert client.get("/api/v1/customer/auth/me").status_code == 401

    email_login = client.post(
        "/api/v1/customer/auth/login",
        json={"identifier": "SAMPLE@example.com", "password": "A-Long-Customer-Password"},
    )
    assert email_login.status_code == 200
    assert email_login.json()["user"]["mobile"] == "9876543210"
    assert client.post("/api/v1/customer/auth/logout").status_code == 204

    mobile_login = client.post(
        "/api/v1/customer/auth/login",
        json={"identifier": "9876543210", "password": "A-Long-Customer-Password"},
    )
    assert mobile_login.status_code == 200


def test_customer_registration_rejects_duplicates_and_login_is_separate_from_admin(client):
    registration = registration_payload()
    assert client.post("/api/v1/customer/auth/register", json=registration).status_code == 201
    assert client.post("/api/v1/customer/auth/register", json=registration).status_code == 409
    assert client.post(
        "/api/v1/customer/auth/login",
        json={"identifier": registration["mobile"], "password": "wrong-password"},
    ).status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_role_is_not_self_assignable_and_admins_can_manage_customers(client, monkeypatch):
    assert client.get("/api/v1/admin/customers").status_code == 401

    first_registration = registration_payload() | {"is_admin": True}
    first_registration_response = client.post("/api/v1/customer/auth/register", json=first_registration)
    assert first_registration_response.status_code == 201
    assert first_registration_response.json()["user"]["is_admin"] is False
    assert client.get("/api/v1/admin/customers").status_code == 403

    second_registration = registration_payload() | {
        "name": "Second Customer",
        "email": "second@example.com",
        "mobile": "9876543211",
    }
    assert client.post("/api/v1/customer/auth/register", json=second_registration).status_code == 201

    monkeypatch.setattr(settings, "admin_phone", "9876500000")
    monkeypatch.setattr(settings, "admin_password_hash", PasswordHash.recommended().hash("A-Secure-Admin-Password"))
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "9876500000", "password": "A-Secure-Admin-Password"},
    )
    assert admin_login.status_code == 200

    promoted = client.patch("/api/v1/admin/customers/1/role", json={"is_admin": True})
    assert promoted.status_code == 200
    assert promoted.json()["is_admin"] is True
    assert client.get("/api/v1/admin/customers").status_code == 200

    assert client.post("/api/v1/auth/logout").status_code == 204
    customer_login = client.post(
        "/api/v1/customer/auth/login",
        json={"identifier": "9876543210", "password": "A-Long-Customer-Password"},
    )
    assert customer_login.status_code == 200
    assert customer_login.json()["user"]["is_admin"] is True
    customer_admin_update = client.patch("/api/v1/admin/customers/2/role", json={"is_admin": True})
    assert customer_admin_update.status_code == 200
    assert customer_admin_update.json()["is_admin"] is True


def test_admin_product_crud_is_authorized_and_delete_is_soft(client, monkeypatch):
    assert client.get("/api/v1/admin/products").status_code == 401
    configure_admin(client, monkeypatch)

    created = client.post(
        "/api/v1/admin/products",
        json={
            "name": "Sparkle Fountain",
            "category": "Flower Pots",
            "mrp": 1000,
            "price": 100,
            "pack_unit": "Box",
            "pieces": "5",
            "description": "Low-noise fountain",
            "stock_quantity": 3,
            "is_active": True,
        },
    )
    assert created.status_code == 201
    product_id = created.json()["id"]
    assert created.json()["stock_quantity"] == 3
    assert created.json()["image_url"] is None

    invalid = client.put(
        f"/api/v1/admin/products/{product_id}",
        json={
            "name": "Invalid Price",
            "category": "Flower Pots",
            "mrp": 10,
            "price": 20,
            "pack_unit": "Box",
        },
    )
    assert invalid.status_code == 422

    updated = client.put(
        f"/api/v1/admin/products/{product_id}",
        json={
            "name": "Sparkle Fountain XL",
            "category": "Flower Pots",
            "mrp": 1200,
            "price": 120,
            "pack_unit": "Box",
            "stock_quantity": 4,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Sparkle Fountain XL"

    assert client.delete(f"/api/v1/admin/products/{product_id}").status_code == 204
    assert client.get(f"/api/v1/products/{product_id}").status_code == 404
    inactive = next(item for item in client.get("/api/v1/admin/products").json() if item["id"] == product_id)
    assert inactive["is_active"] is False


def test_admin_orders_are_database_paginated_and_delivery_status_persists(client, monkeypatch):
    assert client.get("/api/v1/admin/orders").status_code == 401
    configure_admin(client, monkeypatch)

    for _ in range(12):
        created = client.post(
            "/api/v1/orders",
            json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 2, "quantity": 1}]},
        )
        assert created.status_code == 201
        assert created.json()["delivery_status"] == "Placed"

    first_page = client.get("/api/v1/admin/orders")
    assert first_page.status_code == 200
    assert len(first_page.json()["orders"]) == 10
    assert first_page.json()["current_page"] == 1
    assert first_page.json()["page_size"] == 10
    assert first_page.json()["total_items"] == 12
    assert first_page.json()["total_pages"] == 2
    assert client.get("/api/v1/admin/orders?page_size=11").status_code == 422

    order_id = first_page.json()["orders"][0]["order_id"]
    details = client.get(f"/api/v1/admin/orders/{order_id}")
    assert details.status_code == 200
    assert details.json()["items"][0]["name"] == "Flower Pot"
    assert client.patch(
        f"/api/v1/admin/orders/{order_id}/delivery-status",
        json={"delivery_status": "In Transit"},
    ).status_code == 422
    updated = client.patch(
        f"/api/v1/admin/orders/{order_id}/delivery-status",
        json={"delivery_status": "Shipped"},
    )
    assert updated.status_code == 200
    assert updated.json()["delivery_status"] == "Shipped"
    assert client.get(f"/api/v1/admin/orders/{order_id}").json()["delivery_status"] == "Shipped"


def test_admin_image_upload_validates_type_and_auth(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    png_signature = b"\x89PNG\r\n\x1a\n" + b"test image bytes"
    assert client.post(
        "/api/v1/admin/product-images",
        content=png_signature,
        headers={"content-type": "image/png"},
    ).status_code == 401
    configure_admin(client, monkeypatch)
    uploaded = client.post(
        "/api/v1/admin/product-images",
        content=png_signature,
        headers={"content-type": "image/png"},
    )
    assert uploaded.status_code == 201
    assert uploaded.json()["image_url"].startswith("/media/")
    assert len(list(tmp_path.iterdir())) == 1
    rejected = client.post(
        "/api/v1/admin/product-images",
        content=b"not an image",
        headers={"content-type": "image/png"},
    )
    assert rejected.status_code == 415


def test_admin_order_pdf_is_admin_only_and_contains_persisted_order(client, monkeypatch):
    order = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 2, "quantity": 1}]},
    ).json()
    path = f"/api/v1/admin/orders/{order['order_id']}/pdf"
    assert client.get(path).status_code == 401
    pytest.importorskip("reportlab")
    configure_admin(client, monkeypatch)
    response = client.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert f"order-{order['order_id']}.pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_catalog_seed_only_inserts_missing_products(tmp_path, monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    testing_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with testing_sessions.begin() as db:
        db.add(Product(
            id=1,
            name="Admin-edited name",
            category="Admin category",
            mrp=100,
            price=10,
            pack_unit="Box",
            is_active=False,
        ))
    monkeypatch.setattr("app.seed_catalog.SessionLocal", testing_sessions)
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(
        '[{"id":1,"name":"Old seed name","category":"Old category","mrp":80,"price":8,"pack_unit":"Pkt","pieces":null},'
        '{"id":2,"name":"New seeded product","category":"Sparklers","mrp":50,"price":5,"pack_unit":"Box","pieces":null}]',
        encoding="utf-8",
    )

    assert seed_catalog(catalog_path) == 1
    with testing_sessions() as db:
        existing = db.get(Product, 1)
        inserted = db.scalar(select(Product).where(Product.id == 2))
        assert existing.name == "Admin-edited name"
        assert existing.is_active is False
        assert inserted.name == "New seeded product"
        assert inserted.is_active is True
    engine.dispose()


def test_guest_orders_remain_unlinked_and_customer_orders_attach_to_account(client):
    guest_order = client.post(
        "/api/v1/orders",
        json={
            "customer": customer(),
            "payment_method": "cod",
            "items": [{"product_id": 2, "quantity": 1}],
            "user_category": "loginuser",
        },
    )
    assert guest_order.status_code == 201
    assert guest_order.json()["order_id"]
    assert guest_order.json()["user_category"] == "guest"

    registration = client.post("/api/v1/customer/auth/register", json=registration_payload())
    assert registration.status_code == 201
    customer_order = client.post(
        "/api/v1/orders",
        json={"customer": customer(), "payment_method": "cod", "items": [{"product_id": 2, "quantity": 1}]},
    )
    assert customer_order.status_code == 201
    assert customer_order.json()["order_id"] != guest_order.json()["order_id"]
    assert customer_order.json()["user_category"] == "loginuser"