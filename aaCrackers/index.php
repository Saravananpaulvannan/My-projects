<?php
declare(strict_types=1);

// Front controller for the React storefront. The bundle is built with relative
// asset URLs, so this script injects <base href="..."> pointing at the folder
// this copy of the app lives in. That keeps one build working at the document
// root or in any subfolder (for example public_html/aaCrackers).

$document = __DIR__ . '/index.html';
if (!is_file($document)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Frontend build missing: run the Vite build and copy dist/ into this folder.';
    exit;
}

$scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
$directory = ($scriptName === '' || strpos($scriptName, '/') === false) ? '' : dirname($scriptName);
$base = ($directory === '/' || $directory === '.') ? '' : rtrim($directory, '/');
$baseHref = $base === '' ? '/' : $base . '/';

$html = file_get_contents($document);
if ($html === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Frontend build could not be read.';
    exit;
}

if (stripos($html, '<base ') === false) {
    $baseTag = '<base href="' . htmlspecialchars($baseHref, ENT_QUOTES, 'UTF-8') . '">';
    $html = preg_replace('#<head(\s[^>]*)?>#i', '$0' . "\n    " . $baseTag, $html, 1) ?? $html;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;