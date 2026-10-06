<?php
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'YOUR_MYSQL_DATABASE',
    'db_user' => 'YOUR_MYSQL_USER',
    'db_password' => 'SET_THIS_IN_A_PRIVATE_CONFIG_FILE',
    'admin_name' => 'Store Admin',
    'admin_phone' => '',
    'admin_password_hash' => '',
    'session_ttl_hours' => 12,
    // 'auto' marks session cookies Secure only on HTTPS requests. Use true to
    // force Secure, or false for plain HTTP-only testing.
    'session_cookie_secure' => 'auto',
    'cors_origins' => [],
    // 'auto' detects the folder this app is served from, so the same files work
    // in any subfolder. Set '/subfolder' or '' (document root) to override.
    'public_base_path' => 'auto',
    'upload_dir' => __DIR__ . '/uploads',
];
