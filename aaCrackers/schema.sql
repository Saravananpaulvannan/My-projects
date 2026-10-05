CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(240) NOT NULL,
    category VARCHAR(100) NOT NULL,
    mrp INT UNSIGNED NOT NULL,
    price INT UNSIGNED NOT NULL,
    pack_unit VARCHAR(40) NOT NULL,
    pieces JSON NULL,
    description TEXT NULL,
    image_path VARCHAR(255) NULL,
    stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY ix_products_category (category),
    KEY ix_products_active_id (is_active, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_name VARCHAR(160) NOT NULL,
    user_email VARCHAR(254) NULL,
    user_mobile VARCHAR(10) NOT NULL,
    user_addr1 VARCHAR(240) NULL,
    user_addr2 VARCHAR(240) NULL,
    pincode VARCHAR(6) NULL,
    password VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY ix_users_user_email (user_email),
    KEY ix_users_user_mobile (user_mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(160) NOT NULL,
    phone VARCHAR(10) NOT NULL,
    email VARCHAR(254) NULL,
    address TEXT NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    user_category VARCHAR(16) NOT NULL DEFAULT 'guest',
    user_id INT UNSIGNED NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'received',
    delivery_status ENUM('Placed','Packed','Shipped','Delivered') NOT NULL DEFAULT 'Placed',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ix_orders_order_number (order_number),
    KEY ix_orders_user_id (user_id),
    KEY ix_orders_created_at (created_at),
    KEY ix_orders_delivery_created (delivery_status, created_at),
    CONSTRAINT fk_orders_user_id_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    name VARCHAR(240) NOT NULL,
    pack_unit VARCHAR(40) NOT NULL,
    pieces JSON NULL,
    mrp INT UNSIGNED NOT NULL,
    price INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (id),
    KEY ix_order_items_order_id (order_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL,
    phone VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY ix_admin_sessions_token_hash (token_hash),
    KEY ix_admin_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_sessions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY ix_customer_sessions_token_hash (token_hash),
    KEY ix_customer_sessions_user_id (user_id),
    KEY ix_customer_sessions_expires_at (expires_at),
    CONSTRAINT fk_customer_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
