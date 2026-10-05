# Aaradhaya Crackers API

FastAPI service for the product catalog, COD order creation, and admin sessions. Product prices and order totals are calculated by the server. Admin authentication is configured separately from the frontend.

## Local setup

Use Python 3.11 or newer. Local development uses the supplied SQLite database at `Backend/aradhaya_crackers.db`; no PostgreSQL server is required. From the repository root:

```powershell
python -m venv Backend/.venv
Backend/.venv/Scripts/python -m pip install -r Backend/requirements.txt
```

Copy `Backend/.env.example` to `Backend/.env`. Its SQLite URL points to the supplied database. The migration is additive: it leaves the existing `users` table untouched and creates the catalog/order/session tables. Apply it and seed the catalog:

```powershell
Backend/.venv/Scripts/python -m alembic -c Backend/alembic.ini upgrade head
npm --prefix Frontend run export-catalog
$env:PYTHONPATH = (Resolve-Path Backend).Path
.\Backend\.venv\Scripts\python.exe -m app.seed_catalog
Remove-Item Env:PYTHONPATH
.\Backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir Backend --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `/docs`. The frontend Vite server proxies `/api` to this local service.

## Admin setup

Generate an Argon2 password hash interactively:

```powershell
$env:PYTHONPATH = (Resolve-Path Backend).Path
.\Backend\.venv\Scripts\python.exe -m app.hash_password
Remove-Item Env:PYTHONPATH
```

Set `ADMIN_PHONE` and `ADMIN_PASSWORD_HASH` in `Backend/.env`. Set `SESSION_COOKIE_SECURE=true` behind HTTPS. The session cookie is HttpOnly, SameSite=Lax, and backed by a hashed token stored in the database.

## API

- `GET /api/v1/products?category=Flower%20Pots&q=peacock&sort=low`
- `GET /api/v1/products/{id}`
- `GET /api/v1/categories`
- `POST /api/v1/orders` with customer details, `payment_method: "cod"`, and product IDs/quantities
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`

Order minimums apply to the server-calculated product subtotal: ₹3,000 for Tamil Nadu and ₹5,000 for other states. Delivery fee is ₹0. Only COD orders are accepted.
Orders include `user_category`, set by the server to `loginuser` for a valid customer session or `guest` otherwise. Existing orders are backfilled as `guest` by the next migration.

## Tests

```powershell
Backend/.venv/Scripts/python -m pytest Backend/tests -q
```