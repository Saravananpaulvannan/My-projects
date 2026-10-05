<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['cors_origins'] ?? [], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$isHealthCheck = isset($_GET['health']) && $_GET['health'] === '1';
$path = preg_replace('#^/api/v1#', '', $path) ?: '/';
$pdo = db();

function productPayload(array $data): array
{
    $name = requiredString($data, 'name', 2, 240);
    $category = requiredString($data, 'category', 1, 100);
    $packUnit = requiredString($data, 'pack_unit', 1, 40);
    $price = filter_var($data['price'] ?? null, FILTER_VALIDATE_INT);
    $mrp = filter_var($data['mrp'] ?? null, FILTER_VALIDATE_INT);
    $stock = filter_var($data['stock_quantity'] ?? 0, FILTER_VALIDATE_INT);
    if ($price === false || $price < 1 || $mrp === false || $mrp < $price) {
        fail('Price must be greater than zero and original price must be at least the price.', 422);
    }
    if ($stock === false || $stock < 0) {
        fail('Stock quantity cannot be negative.', 422);
    }
    $pieces = $data['pieces'] ?? null;
    if (is_string($pieces)) {
        $pieces = trim($pieces);
        if ($pieces === '') {
            $pieces = null;
        } elseif (ctype_digit($pieces)) {
            $pieces = (int) $pieces;
        }
    }
    $description = isset($data['description']) ? trim((string) $data['description']) : null;
    if ($description !== null && textLength($description) > 4000) {
        fail('Description must be 4000 characters or fewer.', 422);
    }
    $imageUrl = $data['image_url'] ?? null;
    $imagePath = null;
    if ($imageUrl !== null && $imageUrl !== '') {
        if (!preg_match('#^/media/([a-f0-9]{32}\.(?:jpg|png|gif|webp))$#', (string) $imageUrl, $matches)) {
            fail('Image must be uploaded through the admin image endpoint.', 422);
        }
        $imagePath = $matches[1];
    }
    return [
        'name' => $name,
        'category' => $category,
        'mrp' => $mrp,
        'price' => $price,
        'pack_unit' => $packUnit,
        'pieces' => $pieces === null ? null : json_encode($pieces, JSON_THROW_ON_ERROR),
        'description' => $description === '' ? null : $description,
        'image_path' => $imagePath,
        'stock_quantity' => $stock,
        'is_active' => !array_key_exists('is_active', $data) || filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN),
    ];
}

function writeProduct(PDO $pdo, array $values, ?int $productId = null): array
{
    if ($productId === null) {
        $statement = $pdo->prepare(
            'INSERT INTO products (name, category, mrp, price, pack_unit, pieces, description, image_path, stock_quantity, is_active) '
            . 'VALUES (:name, :category, :mrp, :price, :pack_unit, :pieces, :description, :image_path, :stock_quantity, :is_active)'
        );
    } else {
        $values['id'] = $productId;
        $statement = $pdo->prepare(
            'UPDATE products SET name=:name, category=:category, mrp=:mrp, price=:price, pack_unit=:pack_unit, pieces=:pieces, '
            . 'description=:description, image_path=:image_path, stock_quantity=:stock_quantity, is_active=:is_active WHERE id=:id'
        );
    }
    $statement->execute($values);
    $id = $productId ?? (int) $pdo->lastInsertId();
    $row = productById($pdo, $id);
    if (!$row) {
        fail('Product not found.', 404);
    }
    return publicProduct($row, true);
}

function sendOrderPdf(PDO $pdo, array $order): never
{
    if (!class_exists(\Dompdf\Dompdf::class)) {
        fail('PDF support is not installed on this server.', 503);
    }
    $public = publicOrder($pdo, $order);
    $escape = static fn ($value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $itemRows = '';
    foreach ($public['items'] as $item) {
        $itemRows .= '<tr><td>' . $escape($item['name']) . '</td><td>' . $item['quantity'] . '</td><td>Rs. '
            . number_format($item['price']) . '</td><td>Rs. ' . number_format($item['line_total']) . '</td></tr>';
    }
    $address = implode(', ', array_filter([
        $public['customer']['address'], $public['customer']['city'], $public['customer']['state'], $public['customer']['pincode'],
    ]));
    $html = '<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:DejaVu Sans,sans-serif;color:#241a17;font-size:12px}h1{color:#7a1f2b}table{width:100%;border-collapse:collapse;margin:18px 0}
        th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f6efe3}.totals{width:45%;margin-left:auto}.totals td{border:0;border-bottom:1px solid #ddd}
        </style></head><body><h1>Aaradhaya Crackers</h1><h2>Order details</h2><p><b>Order ID:</b> ' . $escape($public['order_id'])
        . '<br><b>Order date:</b> ' . $escape($public['placed_at']) . '<br><b>Customer:</b> ' . $escape($public['customer']['name'])
        . '<br><b>Contact:</b> ' . $escape($public['customer']['phone']) . '<br><b>Delivery address:</b> ' . $escape($address) . '</p>'
        . '<table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>' . $itemRows . '</tbody></table>'
        . '<table class="totals"><tr><td>Subtotal</td><td>Rs. ' . number_format($public['subtotal']) . '</td></tr>'
        . '<tr><td>Delivery</td><td>Rs. 0</td></tr><tr><td><b>Total</b></td><td><b>Rs. ' . number_format($public['total'])
        . '</b></td></tr><tr><td>Payment</td><td>Due on delivery (COD)</td></tr><tr><td>Delivery status</td><td>'
        . $escape($public['delivery_status']) . '</td></tr></table></body></html>';
    $pdf = new \Dompdf\Dompdf();
    $pdf->loadHtml($html, 'UTF-8');
    $pdf->setPaper('A4');
    $pdf->render();
    header('Content-Type: application/pdf');
    header('Cache-Control: no-store, private');
    header('Content-Disposition: attachment; filename="order-' . preg_replace('/[^A-Za-z0-9_-]/', '', $order['order_number']) . '.pdf"');
    echo $pdf->output();
    exit;
}

try {
    if ($isHealthCheck || ($method === 'GET' && $path === '/health')) {
        jsonResponse(['status' => 'ok']);
    }

    if ($method === 'GET' && $path === '/products') {
        $where = ['is_active = 1'];
        $params = [];
        $category = trim((string) ($_GET['category'] ?? ''));
        $query = trim((string) ($_GET['q'] ?? ''));
        if ($category !== '' && strcasecmp($category, 'all') !== 0) {
            $where[] = 'category = ?';
            $params[] = $category;
        }
        if ($query !== '') {
            $where[] = 'name LIKE ?';
            $params[] = '%' . $query . '%';
        }
        $sort = $_GET['sort'] ?? 'default';
        if (!in_array($sort, ['default', 'low', 'high'], true)) {
            fail('Invalid sort value.', 422);
        }
        $orderBy = $sort === 'low' ? 'price ASC, id ASC' : ($sort === 'high' ? 'price DESC, id ASC' : 'id ASC');
        $stmt = $pdo->prepare('SELECT * FROM products WHERE ' . implode(' AND ', $where) . ' ORDER BY ' . $orderBy);
        $stmt->execute($params);
        jsonResponse(array_map(static fn ($row) => publicProduct($row), $stmt->fetchAll()));
    }

    if ($method === 'GET' && $path === '/categories') {
        $stmt = $pdo->query('SELECT category FROM products WHERE is_active=1 GROUP BY category ORDER BY MIN(id)');
        jsonResponse(array_column($stmt->fetchAll(), 'category'));
    }

    if ($method === 'GET' && preg_match('#^/products/(\d+)$#', $path, $match)) {
        $row = productById($pdo, (int) $match[1]);
        if (!$row || !(int) $row['is_active']) {
            fail('Product not found.', 404);
        }
        jsonResponse(publicProduct($row));
    }

    if ($method === 'GET' && $path === '/customer/auth/me') {
        $customer = activeCustomer($pdo);
        if (!$customer) fail('Not authenticated', 401);
        jsonResponse(publicUser($customer));
    }

    if ($method === 'POST' && $path === '/customer/auth/register') {
        $data = requestJson();
        $name = requiredString($data, 'name', 2, 160);
        $mobile = trim((string) ($data['mobile'] ?? ''));
        if (!preg_match('/^[6-9]\d{9}$/', $mobile)) fail('Enter a valid mobile number.', 422);
        $email = isset($data['email']) && trim((string) $data['email']) !== '' ? strtolower(trim((string) $data['email'])) : null;
        if ($email !== null && (!filter_var($email, FILTER_VALIDATE_EMAIL) || textLength($email) > 254)) fail('Enter a valid email address.', 422);
        $password = (string) ($data['password'] ?? '');
        if (textLength($password) < 12 || textLength($password) > 256) fail('Password must be between 12 and 256 characters.', 422);
        $address1 = isset($data['address_line1']) ? trim((string) $data['address_line1']) : null;
        $address2 = isset($data['address_line2']) ? trim((string) $data['address_line2']) : null;
        $pincode = isset($data['pincode']) && $data['pincode'] !== '' ? (string) $data['pincode'] : null;
        if ($pincode !== null && !preg_match('/^\d{6}$/', $pincode)) fail('Pincode must contain six digits.', 422);
        if (!defined('PASSWORD_ARGON2ID')) fail('PHP Argon2id support is required on this hosting plan.', 503);
        $pdo->beginTransaction();
        try {
            $duplicate = $pdo->prepare('SELECT id FROM users WHERE user_mobile = ? OR (? IS NOT NULL AND user_email = ?) LIMIT 1');
            $duplicate->execute([$mobile, $email, $email]);
            if ($duplicate->fetch()) {
                $pdo->rollBack();
                fail('An account with this mobile number or email already exists.', 409);
            }
            $insert = $pdo->prepare('INSERT INTO users (user_name,user_email,user_mobile,user_addr1,user_addr2,pincode,password,is_admin) VALUES (?,?,?,?,?,?,?,0)');
            $insert->execute([$name, $email, $mobile, $address1 ?: null, $address2 ?: null, $pincode, password_hash($password, PASSWORD_ARGON2ID)]);
            $userId = (int) $pdo->lastInsertId();
            $token = newCustomerSession($pdo, $userId);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        setSessionCookie('customer_session', $token, ((int) $config['session_ttl_hours']) * 3600);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id=?');
        $stmt->execute([$userId]);
        jsonResponse(['user' => publicUser($stmt->fetch())], 201);
    }

    if ($method === 'POST' && $path === '/customer/auth/login') {
        $data = requestJson();
        $identifier = trim((string) ($data['identifier'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        if ($identifier === '' || $password === '') fail('Enter your email/mobile and password.', 422);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE user_mobile = ? OR LOWER(user_email) = LOWER(?) LIMIT 2');
        $stmt->execute([$identifier, $identifier]);
        $matches = $stmt->fetchAll();
        if (count($matches) !== 1 || !password_verify($password, $matches[0]['password'])) fail('Invalid email/mobile or password.', 401);
        $token = newCustomerSession($pdo, (int) $matches[0]['id']);
        setSessionCookie('customer_session', $token, ((int) $config['session_ttl_hours']) * 3600);
        jsonResponse(['user' => publicUser($matches[0])]);
    }

    if ($method === 'POST' && $path === '/customer/auth/logout') {
        revokeSession($pdo, 'customer_session', 'customer_sessions');
        jsonResponse(null, 204);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        $data = requestJson();
        $phone = trim((string) ($data['phone'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        if (!preg_match('/^[6-9]\d{9}$/', $phone) || $password === '') fail('Invalid phone number or password.', 401);
        if (empty($config['admin_phone']) || empty($config['admin_password_hash'])
            || $phone !== $config['admin_phone'] || !password_verify($password, $config['admin_password_hash'])) {
            fail('Invalid phone number or password.', 401);
        }
        $token = newAdminSession($pdo, $phone);
        setSessionCookie('admin_session', $token, ((int) $config['session_ttl_hours']) * 3600);
        jsonResponse(['admin' => ['name' => $config['admin_name'], 'phone' => $phone]]);
    }

    if ($method === 'GET' && $path === '/auth/me') {
        $admin = activeAdmin($pdo);
        if (!$admin) fail('Not authenticated', 401);
        jsonResponse(['name' => $config['admin_name'], 'phone' => $admin['phone']]);
    }

    if ($method === 'POST' && $path === '/auth/logout') {
        revokeSession($pdo, 'admin_session', 'admin_sessions');
        jsonResponse(null, 204);
    }

    if ($method === 'GET' && $path === '/admin/customers') {
        requireAdmin($pdo);
        $rows = $pdo->query('SELECT id,user_name,user_email,user_mobile,is_admin FROM users ORDER BY id')->fetchAll();
        jsonResponse(array_map('publicAdminCustomer', $rows));
    }

    if ($method === 'PATCH' && preg_match('#^/admin/customers/(\d+)/role$#', $path, $match)) {
        requireAdmin($pdo);
        $data = requestJson();
        if (!array_key_exists('is_admin', $data) || !is_bool($data['is_admin'])) fail('is_admin must be true or false.', 422);
        $stmt = $pdo->prepare('UPDATE users SET is_admin=? WHERE id=?');
        $stmt->execute([$data['is_admin'] ? 1 : 0, (int) $match[1]]);
        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM users WHERE id=?');
            $check->execute([(int) $match[1]]);
            if (!$check->fetch()) fail('Customer not found.', 404);
        }
        $stmt = $pdo->prepare('SELECT id,user_name,user_email,user_mobile,is_admin FROM users WHERE id=?');
        $stmt->execute([(int) $match[1]]);
        jsonResponse(publicAdminCustomer($stmt->fetch()));
    }

    if ($method === 'GET' && $path === '/admin/dashboard') {
        requireAdmin($pdo);
        $result = $pdo->query("SELECT (SELECT COUNT(*) FROM products) product_count, (SELECT COUNT(*) FROM products WHERE is_active=1) active_product_count, (SELECT COUNT(*) FROM orders) order_count, (SELECT COUNT(*) FROM orders WHERE delivery_status <> 'Delivered') pending_delivery_count, (SELECT COALESCE(SUM(total),0) FROM orders) total_revenue")->fetch();
        foreach ($result as $key => $value) $result[$key] = (int) $value;
        jsonResponse($result);
    }

    if ($method === 'GET' && $path === '/admin/products') {
        requireAdmin($pdo);
        $rows = $pdo->query('SELECT * FROM products ORDER BY id')->fetchAll();
        jsonResponse(array_map(static fn ($row) => publicProduct($row, true), $rows));
    }

    if (($method === 'POST' && $path === '/admin/products') || ($method === 'PUT' && preg_match('#^/admin/products/(\d+)$#', $path, $match))) {
        requireAdmin($pdo);
        $values = productPayload(requestJson());
        $product = writeProduct($pdo, $values, isset($match[1]) ? (int) $match[1] : null);
        jsonResponse($product, $method === 'POST' ? 201 : 200);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/products/(\d+)$#', $path, $match)) {
        requireAdmin($pdo);
        $stmt = $pdo->prepare('UPDATE products SET is_active=0 WHERE id=?');
        $stmt->execute([(int) $match[1]]);
        if ($stmt->rowCount() === 0 && !productById($pdo, (int) $match[1])) fail('Product not found.', 404);
        jsonResponse(null, 204);
    }

    if ($method === 'POST' && $path === '/admin/product-images') {
        requireAdmin($pdo);
        $bytes = file_get_contents('php://input');
        if (!is_string($bytes) || $bytes === '' || strlen($bytes) > 5 * 1024 * 1024) fail('Image must be between 1 byte and 5 MB.', 413);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
        if (!isset($extensions[$mime])) fail('Upload a PNG, JPEG, GIF, or WebP image.', 415);
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        $directory = rtrim($config['upload_dir'], DIRECTORY_SEPARATOR);
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) fail('Image storage is unavailable.', 500);
        if (file_put_contents($directory . DIRECTORY_SEPARATOR . $filename, $bytes, LOCK_EX) === false) fail('Unable to save image.', 500);
        jsonResponse(['image_url' => '/media/' . $filename], 201);
    }

    if ($method === 'GET' && $path === '/admin/orders') {
        requireAdmin($pdo);
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $pageSize = (int) ($_GET['page_size'] ?? 10);
        if ($pageSize < 1 || $pageSize > 10) fail('page_size must be between 1 and 10.', 422);
        $statusFilter = $_GET['delivery_status'] ?? '';
        if ($statusFilter !== '' && !in_array($statusFilter, ['Placed', 'Packed', 'Shipped', 'Delivered'], true)) fail('Invalid delivery status.', 422);
        $where = $statusFilter !== '' ? ' WHERE o.delivery_status=?' : '';
        $count = $pdo->prepare('SELECT COUNT(*) FROM orders o' . $where);
        $count->execute($statusFilter !== '' ? [$statusFilter] : []);
        $totalItems = (int) $count->fetchColumn();
        $sql = 'SELECT o.order_number,o.created_at,o.customer_name,o.phone,o.total,o.payment_method,o.delivery_status,COALESCE(SUM(i.quantity),0) item_count '
            . 'FROM orders o LEFT JOIN order_items i ON i.order_id=o.id' . $where
            . ' GROUP BY o.id ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?';
        $stmt = $pdo->prepare($sql);
        $params = $statusFilter !== '' ? [$statusFilter, $pageSize, ($page - 1) * $pageSize] : [$pageSize, ($page - 1) * $pageSize];
        foreach ($params as $index => $value) $stmt->bindValue($index + 1, $value, $index >= count($params) - 2 ? PDO::PARAM_INT : PDO::PARAM_STR);
        $stmt->execute();
        $orders = [];
        foreach ($stmt->fetchAll() as $row) {
            $orders[] = [
                'order_id' => $row['order_number'], 'placed_at' => isoDate($row['created_at']),
                'customer_name' => $row['customer_name'], 'phone' => $row['phone'],
                'item_count' => (int) $row['item_count'], 'total' => (int) $row['total'],
                'payment_method' => $row['payment_method'], 'delivery_status' => $row['delivery_status'],
            ];
        }
        jsonResponse(['orders' => $orders, 'current_page' => $page, 'page_size' => $pageSize, 'total_items' => $totalItems, 'total_pages' => (int) ceil($totalItems / $pageSize)]);
    }

    if (preg_match('#^/admin/orders/([A-Za-z0-9_-]+)(?:/(delivery-status|pdf))?$#', $path, $match)) {
        requireAdmin($pdo);
        $order = orderByNumber($pdo, $match[1]);
        if (!$order) fail('Order not found.', 404);
        $action = $match[2] ?? '';
        if ($method === 'GET' && $action === 'pdf') sendOrderPdf($pdo, $order);
        if ($method === 'PATCH' && $action === 'delivery-status') {
            $data = requestJson();
            $allowed = ['Placed', 'Packed', 'Shipped', 'Delivered'];
            if (!in_array($data['delivery_status'] ?? null, $allowed, true)) fail('Invalid delivery status.', 422);
            $stmt = $pdo->prepare('UPDATE orders SET delivery_status=? WHERE id=?');
            $stmt->execute([$data['delivery_status'], (int) $order['id']]);
            jsonResponse(publicOrder($pdo, orderByNumber($pdo, $match[1])));
        }
        if ($method === 'GET' && $action === '') jsonResponse(publicOrder($pdo, $order));
    }

    if ($method === 'POST' && $path === '/orders') {
        $data = requestJson();
        $customer = $data['customer'] ?? null;
        if (!is_array($customer)) fail('Customer details are required.', 422);
        $customerName = requiredString($customer, 'name', 2, 160);
        $phone = trim((string) ($customer['phone'] ?? ''));
        if (!preg_match('/^[6-9]\d{9}$/', $phone)) fail('Enter a valid mobile number.', 422);
        $email = isset($customer['email']) && $customer['email'] !== '' ? (string) $customer['email'] : null;
        if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.', 422);
        $address = requiredString($customer, 'address', 10, 2000);
        $city = requiredString($customer, 'city', 1, 120);
        $state = requiredString($customer, 'state', 1, 120);
        $pincode = trim((string) ($customer['pincode'] ?? ''));
        if (!preg_match('/^\d{6}$/', $pincode)) fail('Pincode must contain six digits.', 422);
        if (($data['payment_method'] ?? null) !== 'cod') fail('Only cash on delivery is supported.', 422);
        $items = $data['items'] ?? null;
        if (!is_array($items) || count($items) < 1 || count($items) > 100) fail('Order must contain between 1 and 100 items.', 422);
        $productIds = [];
        foreach ($items as $item) {
            $id = filter_var($item['product_id'] ?? null, FILTER_VALIDATE_INT);
            $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
            if ($id === false || $id < 1 || $quantity === false || $quantity < 1 || $quantity > 999) fail('Invalid product or quantity.', 422);
            if (isset($productIds[$id])) fail('Each product may only appear once in an order.', 422);
            $productIds[$id] = $quantity;
        }
        $user = activeCustomer($pdo);
        $orderItems = [];
        $subtotal = 0;
        foreach ($productIds as $id => $quantity) {
            $product = productById($pdo, (int) $id);
            if (!$product || !(int) $product['is_active']) fail('One or more products are unavailable. Refresh the catalog and try again.', 422);
            $lineTotal = (int) $product['price'] * $quantity;
            $subtotal += $lineTotal;
            $orderItems[] = [$product, $quantity, $lineTotal];
        }
        $normalizedState = preg_replace('/[^a-z0-9]/', '', strtolower($state));
        $minimum = in_array($normalizedState, ['tamilnadu', 'tn'], true) ? 3000 : 5000;
        if ($subtotal < $minimum) fail('Minimum order for this state is Rs. ' . $minimum . '.', 422);
        $pdo->beginTransaction();
        try {
            $orderNumber = 'AC' . strtoupper(bin2hex(random_bytes(5)));
            $stmt = $pdo->prepare('INSERT INTO orders (order_number,customer_name,phone,email,address,city,state,pincode,payment_method,user_category,user_id,subtotal,total,status,delivery_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$orderNumber, $customerName, $phone, $email, $address, $city, $state, $pincode, 'cod', $user ? 'loginuser' : 'guest', $user ? (int) $user['id'] : null, $subtotal, $subtotal, 'received', 'Placed']);
            $orderId = (int) $pdo->lastInsertId();
            $itemInsert = $pdo->prepare('INSERT INTO order_items (order_id,product_id,name,pack_unit,pieces,mrp,price,quantity,line_total) VALUES (?,?,?,?,?,?,?,?,?)');
            foreach ($orderItems as [$product, $quantity, $lineTotal]) {
                $itemInsert->execute([$orderId, (int) $product['id'], $product['name'], $product['pack_unit'], $product['pieces'], (int) $product['mrp'], (int) $product['price'], $quantity, $lineTotal]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(publicOrder($pdo, orderByNumber($pdo, $orderNumber)), 201);
    }

    fail('Not found.', 404);
} catch (PDOException $error) {
    error_log('MySQL API error: ' . $error->getMessage());
    if ((string) $error->getCode() === '23000') fail('That record conflicts with existing data.', 409);
    fail('A database error occurred.', 500);
} catch (Throwable $error) {
    error_log('PHP API error: ' . $error->getMessage());
    fail('An unexpected server error occurred.', 500);
}
