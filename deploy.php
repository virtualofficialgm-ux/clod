<?php
// Обновление сайта с GitHub. Вызывается вебхуком GitHub после каждого изменения
// (в том числе сохранения в админке): https://teatrnv.ru/deploy.php
// Делает то же, что deploy.sh: забирает свежую версию ветки main.
header('Content-Type: text/plain; charset=utf-8');

// не чаще раза в 15 секунд
$lock = sys_get_temp_dir() . '/teatrnv-deploy.lock';
if (file_exists($lock) && time() - filemtime($lock) < 15) {
    http_response_code(429);
    exit("Слишком часто, попробуйте позже\n");
}
touch($lock);

$dir = escapeshellarg(__DIR__);
exec("cd $dir && git fetch -q --depth 1 origin main 2>&1 && git reset -q --hard origin/main 2>&1", $out, $code);
http_response_code($code === 0 ? 200 : 500);
echo $code === 0 ? "Сайт обновлён\n" : "Ошибка обновления:\n" . implode("\n", $out) . "\n";
