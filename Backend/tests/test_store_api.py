from pwdlib import PasswordHash

from app.config import settings


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