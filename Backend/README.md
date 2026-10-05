# Aaradhaya Crackers API

FastAPI service for the product catalog, COD order creation, and admin sessions. Product prices and order totals are calculated by the server. Admin APIs use the configured admin session or a customer profile with `is_admin=true`.

## Local setup

Use Python 3.11 or newer. Local development uses the supplied SQLite database at `Backend/aradhaya_crackers.db`; no PostgreSQL server is required. From the repository root:

```powershell
python -m venv Backend/.venv
Backend/.venv/Scripts/python -m pip install -r Backend/requirements.txt
```

Copy `Backend/.env.example` to `Backend/.env`. Its SQLite URL points to the supplied database. Migrations are additive and preserve existing users, products, and orders. Apply them and import any missing bootstrap catalog products:

```powershell
Backend/.venv/Scripts/python -m alembic -c Backend/alembic.ini upgrade head
npm --prefix Frontend run export-catalog
$env:PYTHONPATH = (Resolve-Path Backend).Path
.\Backend\.venv\Scripts\python.exe -m app.seed_catalog
Remove-Item Env:PYTHONPATH
.\Backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir Backend --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `/docs`. The frontend Vite server proxies `/api` and `/media` to this local service. Uploaded images are stored under `UPLOAD_DIR` (default `Backend/uploads`); deployments must mount persistent storage at that location. Product updates are database-authoritative: exporting or importing the catalog never overwrites existing database product records.

The admin workspace provides product management, order details, delivery-status updates, customer access management, and server-generated order PDFs. Install dependencies from `Backend/requirements.txt` to enable PDF generation (ReportLab).

## Migrate SQLite data to MySQL

Use MySQL 8 or compatible and create an empty destination database and user first. Stop the backend during migration. Install the updated backend requirements manually so the MySQL driver is available:

```powershell
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements.txt
```

In `Backend/.env`, keep `SQLITE_SOURCE_URL` pointed at the existing SQLite file and set `DATABASE_URL` to the destination, for example:

```dotenv
SQLITE_SOURCE_URL=sqlite:///./Backend/aradhaya_crackers.db
DATABASE_URL=mysql+pymysql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:3306/DB_NAME?charset=utf8mb4
```

Percent-encode special characters in the password. From the repository root, run:

```powershell
$env:PYTHONPATH = (Resolve-Path Backend).Path
Backend/.venv/Scripts/python.exe -m app.migrate_sqlite_to_mysql
Remove-Item Env:PYTHONPATH
```

The script upgrades both schemas to the current Alembic head, copies products, users, orders, order items, and sessions in foreign-key order, preserves IDs, checks row counts, and refuses to merge into non-empty application tables in MySQL. Keep a backup of the SQLite file until the MySQL app has been verified. Product image files are stored outside the database; copy `Backend/uploads` to the configured persistent upload directory separately if it contains images. The backend uses MySQL after the migration because `DATABASE_URL` remains set to the MySQL URL.

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