<?php
// =========================================================
// Приём заявки с сайта и отправка её в Telegram.
// Работает на любом обычном хостинге с PHP 7.4+ (Beget, Timeweb, REG.RU).
// Настройки (токен бота и chat_id) лежат в config.php — см. TELEGRAM.md
// =========================================================
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['ok' => false, 'error' => $message]);
}

// ---------- 1. Принимаем только POST ----------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Метод не поддерживается');
}

// ---------- 2. Загружаем настройки ----------
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('send.php: нет файла config.php');
    fail(500, 'Форма временно не работает. Пожалуйста, позвоните нам.');
}
$config = require $configFile;
$token = (string)($config['bot_token'] ?? '');
$chatIds = (array)($config['chat_ids'] ?? []);
if ($token === '' || strpos($token, 'ВСТАВЬТЕ') !== false || !$chatIds) {
    error_log('send.php: в config.php не заполнены bot_token или chat_ids');
    fail(500, 'Форма временно не работает. Пожалуйста, позвоните нам.');
}
date_default_timezone_set((string)($config['timezone'] ?? 'Europe/Moscow'));

// ---------- 3. Читаем данные формы ----------
$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) {
    fail(400, 'Некорректный запрос');
}

// Ловушка для ботов: невидимое поле website люди не заполняют.
// Боту делаем вид, что всё прошло успешно, но ничего не отправляем.
if (!empty($input['website'])) {
    respond(200, ['ok' => true]);
}

// ---------- 4. Защита от повторных отправок: 1 заявка в 30 секунд с одного IP ----------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$lockFile = sys_get_temp_dir() . '/site_form_' . md5($ip);
if (is_file($lockFile) && time() - filemtime($lockFile) < 30) {
    fail(429, 'Заявка уже отправлена. Подождите немного, мы скоро перезвоним.');
}

// ---------- 5. Проверяем и очищаем поля ----------
function clean($value, int $max): string
{
    $value = trim(strip_tags((string)$value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

$name    = clean($input['name'] ?? '', 60);
$phone   = clean($input['phone'] ?? '', 30);
$service = clean($input['service'] ?? '', 60);
$consent = !empty($input['consent']);
$digits  = preg_replace('/\D/', '', $phone);

$nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
if ($nameLength < 2) {
    fail(422, 'Пожалуйста, укажите имя');
}
if (strlen($digits) !== 11) {
    fail(422, 'Проверьте номер телефона');
}
if (!$consent) {
    fail(422, 'Нужно согласие на обработку данных');
}

// ---------- 6. Формируем сообщение ----------
$safeName    = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$safeService = htmlspecialchars($service !== '' ? $service : 'не указана', ENT_QUOTES, 'UTF-8');
$prettyPhone = sprintf('+7 (%s) %s-%s-%s',
    substr($digits, 1, 3), substr($digits, 4, 3), substr($digits, 7, 2), substr($digits, 9, 2));
$when = date('d.m.Y H:i');

$text = "🦷 <b>Новая заявка с сайта</b>\n\n"
      . "👤 <b>Имя:</b> {$safeName}\n"
      . "📞 <b>Телефон:</b> {$prettyPhone}\n"
      . "🩺 <b>Услуга:</b> {$safeService}\n"
      . "🕐 {$when}";

// ---------- 7. Отправляем в Telegram ----------
$url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
$delivered = 0;

foreach ($chatIds as $chatId) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'chat_id'                  => $chatId,
            'text'                     => $text,
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => true,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response !== false && $status === 200) {
        $delivered++;
    } else {
        // Ошибка попадёт в лог хостинга (в панели: «Логи» / error_log)
        error_log("send.php: Telegram не принял заявку для chat_id {$chatId}: HTTP {$status} {$curlError} {$response}");
    }
}

if ($delivered === 0) {
    fail(502, 'Не удалось отправить заявку. Пожалуйста, позвоните нам.');
}

touch($lockFile);
respond(200, ['ok' => true]);
