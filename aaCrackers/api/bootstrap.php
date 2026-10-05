<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

$configPath = dirname(__DIR__) . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['detail' => 'Server configuration is missing. Copy config.example.php to config.php and configure MySQL.']);
    exit;
}
$config = require $configPath;
$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_file($autoload)) {
    require_once $autoload;
}

function db(): PDO
{
    static $pdo = null;
    global $config;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        (int) $config['db_port'],
        $config['db_name']
    );
    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function publicBasePath(): string
{
    global $config;
    $configured = $config['public_base_path'] ?? 'auto';
    if ($configured !== 'auto') {
        return rtrim((string) $configured, '/');
    }
    $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($scriptName === '' || strpos($scriptName, '/') === false) {
        return '';
    }
    $directory = dirname($scriptName);
    return ($directory === '/' || $directory === '.') ? '' : rtrim($directory, '/');
}

function sessionCookieSecure(): bool
{
    global $config;
    $configured = $config['session_cookie_secure'] ?? true;
    if ($configured !== 'auto') {
        return (bool) $configured;
    }
    $https = (string) ($_SERVER['HTTPS'] ?? '');
    if ($https !== '' && strtolower($https) !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function publicPath(string $path): string
{
    return publicBasePath() . '/' . ltrim($path, '/');
}

function stripPublicPath(string $path): string
{
    $base = publicBasePath();
    if ($base !== '' && strpos($path, $base . '/') === 0) {
        return substr($path, strlen($base));
    }
    return $path;
}

function jsonResponse(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    if ($status !== 204) {
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    exit;
}

function fail(string $message, int $status = 400): never
{
    jsonResponse(['detail' => $message], $status);
}

function requestJson(): array
{
    $body = file_get_contents('php://input');
    $value = json_decode($body === false ? '' : $body, true);
    if (!is_array($value)) {
        fail('Invalid JSON request body.', 400);
    }
    return $value;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function requiredString(array $data, string $field, int $min, int $max): string
{
    $value = trim((string) ($data[$field] ?? ''));
    $length = textLength($value);
    if ($length < $min || $length > $max) {
        fail("Invalid {$field}.", 422);
    }
    return $value;
}

function setSessionCookie(string $name, string $token, int $ttl): void
{
    setcookie($name, $token, [
        'expires' => time() + $ttl,
        'path' => '/',
        'secure' => sessionCookieSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clearSessionCookie(string $name): void
{
    setcookie($name, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => sessionCookieSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function tokenHash(?string $token): ?string
{
    return $token ? hash('sha256', $token) : null;
}

function activeAdmin(PDO $pdo): ?array
{
    $hash = tokenHash($_COOKIE['admin_session'] ?? null);
    if (!$hash) {
        return null;
    }
    $statement = $pdo->prepare('SELECT id, phone FROM admin_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()');
    $statement->execute([$hash]);
    return $statement->fetch() ?: null;
}

function activeCustomer(PDO $pdo): ?array
{
    $hash = tokenHash($_COOKIE['customer_session'] ?? null);
    if (!$hash) {
        return null;
    }
    $statement = $pdo->prepare(
        'SELECT u.id, u.user_name, u.user_email, u.user_mobile, u.user_addr1, u.user_addr2, u.pincode, u.is_admin '
        . 'FROM customer_sessions s JOIN users u ON u.id = s.user_id '
        . 'WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()'
    );
    $statement->execute([$hash]);
    return $statement->fetch() ?: null;
}

function requireAdmin(PDO $pdo): array
{
    $admin = activeAdmin($pdo);
    if ($admin !== null) {
        return ['type' => 'configured', 'id' => null, 'phone' => $admin['phone']];
    }
    $customer = activeCustomer($pdo);
    if ($customer && (int) $customer['is_admin'] === 1) {
        return ['type' => 'customer', 'id' => (int) $customer['id'], 'phone' => $customer['user_mobile']];
    }
    fail('Admin access required', $customer ? 403 : 401);
}

function publicUser(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => $row['user_name'],
        'email' => $row['user_email'],
        'mobile' => $row['user_mobile'],
        'address_line1' => $row['user_addr1'],
        'address_line2' => $row['user_addr2'],
        'pincode' => $row['pincode'],
        'is_admin' => (bool) $row['is_admin'],
    ];
}

function publicAdminCustomer(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => $row['user_name'],
        'email' => $row['user_email'],
        'mobile' => $row['user_mobile'],
        'is_admin' => (bool) $row['is_admin'],
    ];
}

function publicProduct(array $row, bool $admin = false): array
{
    $pieces = $row['pieces'] === null ? null : json_decode((string) $row['pieces'], true);
    $result = [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'category' => $row['category'],
        'mrp' => (int) $row['mrp'],
        'price' => (int) $row['price'],
        'pack_unit' => $row['pack_unit'],
        'pieces' => $pieces,
        'description' => $row['description'],
        'image_url' => $row['image_path'] ? publicPath('/media/' . $row['image_path']) : null,
        'stock_quantity' => (int) $row['stock_quantity'],
    ];
    if ($admin) {
        $result['is_active'] = (bool) $row['is_active'];
    }
    return $result;
}

function productById(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare('SELECT * FROM products WHERE id = ? LIMIT 1');
    $statement->execute([$id]);
    return $statement->fetch() ?: null;
}

function customerPasswordHash(string $password): string
{
    if (!defined('PASSWORD_ARGON2ID')) {
        fail('PHP Argon2id support is required for customer password security.', 503);
    }
    $hash = password_hash($password, PASSWORD_ARGON2ID);
    if ($hash === false) {
        fail('Unable to secure the password.', 500);
    }
    return $hash;
}

function newCustomerSession(PDO $pdo, int $userId): string
{
    global $config;
    $token = bin2hex(random_bytes(32));
    $expires = gmdate('Y-m-d H:i:s', time() + ((int) $config['session_ttl_hours'] * 3600));
    $statement = $pdo->prepare('INSERT INTO customer_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
    $statement->execute([hash('sha256', $token), $userId, $expires]);
    return $token;
}

function newAdminSession(PDO $pdo, string $phone): string
{
    global $config;
    $token = bin2hex(random_bytes(32));
    $expires = gmdate('Y-m-d H:i:s', time() + ((int) $config['session_ttl_hours'] * 3600));
    $statement = $pdo->prepare('INSERT INTO admin_sessions (token_hash, phone, expires_at) VALUES (?, ?, ?)');
    $statement->execute([hash('sha256', $token), $phone, $expires]);
    return $token;
}

function revokeSession(PDO $pdo, string $cookieName, string $table): void
{
    $hash = tokenHash($_COOKIE[$cookieName] ?? null);
    if ($hash) {
        $statement = $pdo->prepare("DELETE FROM {$table} WHERE token_hash = ?");
        $statement->execute([$hash]);
    }
    clearSessionCookie($cookieName);
}

function isoDate(?string $value): ?string
{
    if (!$value) {
        return null;
    }
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format(DateTimeInterface::ATOM);
}

function publicOrder(PDO $pdo, array $order): array
{
    $itemsQuery = $pdo->prepare('SELECT product_id, name, pack_unit, pieces, mrp, price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id');
    $itemsQuery->execute([(int) $order['id']]);
    $items = [];
    foreach ($itemsQuery->fetchAll() as $item) {
        $items[] = [
            'product_id' => (int) $item['product_id'],
            'name' => $item['name'],
            'pack_unit' => $item['pack_unit'],
            'pieces' => $item['pieces'] === null ? null : json_decode((string) $item['pieces'], true),
            'mrp' => (int) $item['mrp'],
            'price' => (int) $item['price'],
            'quantity' => (int) $item['quantity'],
            'line_total' => (int) $item['line_total'],
        ];
    }
    return [
        'order_id' => $order['order_number'],
        'placed_at' => isoDate($order['created_at']),
        'status' => $order['status'],
        'delivery_status' => $order['delivery_status'],
        'user_category' => $order['user_category'],
        'customer' => [
            'name' => $order['customer_name'],
            'phone' => $order['phone'],
            'email' => $order['email'],
            'address' => $order['address'],
            'city' => $order['city'],
            'state' => $order['state'],
            'pincode' => $order['pincode'],
        ],
        'payment_method' => $order['payment_method'],
        'items' => $items,
        'subtotal' => (int) $order['subtotal'],
        'delivery_fee' => 0,
        'total' => (int) $order['total'],
    ];
}

function orderByNumber(PDO $pdo, string $orderNumber): ?array
{
    $statement = $pdo->prepare('SELECT * FROM orders WHERE order_number = ? LIMIT 1');
    $statement->execute([$orderNumber]);
    return $statement->fetch() ?: null;
}
