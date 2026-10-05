# PHP + MySQL deployment package

This folder contains the PHP API for the existing React/Vite storefront. It keeps the current `/api/v1` request and response contract so the UI does not need to be rewritten.

## Requirements

- PHP 8.1 or newer with `pdo_mysql`, `fileinfo`, and Argon2id password hashing enabled.
- MySQL 8 (or compatible) database.
- Apache with `mod_rewrite` and `.htaccess` enabled, as on SitePex cPanel.
- Composer to install Dompdf for the admin order PDF endpoint.

## Prepare the package

1. Create a MySQL database and database user from cPanel's MySQL Database Wizard.
2. Import `schema.sql` into that empty database using phpMyAdmin.
3. Copy `config.example.php` to `config.php` and fill in the database name, username, password, admin phone, and an Argon2id admin password hash. Keep `config.php` private; it is excluded from Git.
4. Install the PDF library in this folder with `composer install --no-dev --optimize-autoloader`. Composer is not bundled. If it is unavailable on your plan, ask SitePex support to run it or provide Composer/SSH access.
5. Build the existing React project from the repository root with `npm --prefix Frontend run build`, then copy the contents of `Frontend/dist` into this folder. The package already contains the current build when prepared locally.
6. Ensure `uploads/` is writable by PHP and keep it persistent. Uploaded images are stored there and served at `/media/...`.

## Admin password hash

Use PHP's Argon2id support to create a hash without putting a plaintext password into a file:

```bash
php -r 'echo password_hash("CHOOSE_A_LONG_PASSWORD", PASSWORD_ARGON2ID), PHP_EOL;'
```

Enter the resulting hash into `config.php` as `admin_password_hash`. Do not publish `config.php` or commit it.

## Upload to SitePex

Upload the contents of `phpmysql/` to the document root assigned to `aaradhyacrackers.com` (usually `public_html`). In cPanel, point both the root domain and `www` to the same document root and enable its free SSL certificate. Keep `.htaccess`, `api.php`, `api/`, `uploads/`, `vendor/`, `index.html`, and `assets/` in that document root.

The `.htaccess` routes `/api/v1/...` to PHP, serves uploads through `/media/...`, and sends other client-side routes to React's `index.html`. It requires Apache rewrite support and `AllowOverride` for the document root.

## Existing SQLite data

If you need to retain the existing SQLite catalog, users, orders, and sessions, first migrate that data to a MySQL database using the repository's `Backend/app/migrate_sqlite_to_mysql.py` workflow, targeting this MySQL database. Do not import `schema.sql` over a database already initialized by that migration. Then point `config.php` at the same database. Keep a verified backup of the SQLite database and uploaded images until the live site is confirmed.

## Smoke checks

- Open `https://aaradhyacrackers.com/` and verify the existing React storefront loads.
- Open `https://aaradhyacrackers.com/api/v1/products` and confirm it returns JSON.
- Register and sign in with a test customer, then test admin login, product operations, orders, image upload, and PDF download.
- Remove test accounts/orders before accepting real customers.
