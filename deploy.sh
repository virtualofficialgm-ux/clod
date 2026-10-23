#!/bin/sh
# Обновляет сайт на хостинге до последней версии из GitHub (ветка main).
# Запускается по расписанию (cron) на самом хостинге, пароли не нужны.
cd "$(dirname "$0")" || exit 1
git fetch -q --depth 1 origin main && git reset -q --hard origin/main
