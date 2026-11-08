# SExtract для Windows

Проєкт відкриває вебверсію SExtract у вікні Windows і вбудовує HTML, CSS,
JavaScript та іконку в один self-contained `.exe`.

## Збірка на комп'ютері

Запустіть `build.bat` з Провідника або командного рядка. Потрібен .NET 10 SDK;
під час першої збірки NuGet завантажить пакет WebView2. Готовий файл з'явиться
у `dist\SExtract.exe`.

## Автоматична збірка на GitHub

Workflow `.github/workflows/build-windows-portable.yml` збирає застосунок після
push змін або вручну через **Actions → Build SExtract Windows portable →
Run workflow**. Після завершення збірки завантажте
`SExtract-Portable-Windows-x64` у секції **Artifacts** запуску workflow.

Файл містить .NET runtime і вебзастосунок. Для його відкриття потрібен
Microsoft Edge WebView2 Runtime, який зазвичай уже встановлений у Windows 11.
Отже, це portable-програма без інсталятора, але не повністю автономна від
WebView2 Runtime.
