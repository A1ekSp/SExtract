using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Reflection;

namespace SExtract.Desktop;

internal sealed class MainForm : Form
{
    private const string VirtualHost = "sextract.local";
    private const string AppDataFolderName = "SExtract";
    private readonly WebView2 _webView = new();
    private readonly string _webRoot = Path.Combine(Path.GetTempPath(), AppDataFolderName, "Web");
    private readonly string _userDataRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        AppDataFolderName,
        "WebView2");
    private bool _initializing;

    public MainForm()
    {
        Text = "SExtract — Audio from Video";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(720, 680);
        Size = new Size(1000, 900);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? string.Empty)
            ?? SystemIcons.Application;

        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);
        Shown += InitializeWebViewAsync;
    }

    private async void InitializeWebViewAsync(object? sender, EventArgs e)
    {
        if (_initializing)
            return;

        _initializing = true;
        UseWaitCursor = true;

        try
        {
            ExtractWebAssets();
            Directory.CreateDirectory(_userDataRoot);

            string? runtimeVersion = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrWhiteSpace(runtimeVersion))
            {
                throw new InvalidOperationException(
                    "Microsoft Edge WebView2 Runtime не знайдено.");
            }

            var environment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: _userDataRoot);

            await _webView.EnsureCoreWebView2Async(environment);

            CoreWebView2 core = _webView.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;

            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                _webRoot,
                CoreWebView2HostResourceAccessKind.Allow);

            core.DownloadStarting += HandleDownloadStarting;
            core.NewWindowRequested += (_, args) => args.Handled = true;
            core.NavigationStarting += (_, args) =>
            {
                if (!args.Uri.StartsWith(
                        $"https://{VirtualHost}/",
                        StringComparison.OrdinalIgnoreCase))
                {
                    args.Cancel = true;
                }
            };

            _webView.Source = new Uri($"https://{VirtualHost}/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                this,
                "Не вдалося запустити SExtract.\n\n" + ex.Message +
                "\n\nДля роботи потрібен Microsoft Edge WebView2 Runtime. " +
                "У Windows 11 він зазвичай уже встановлений; у Windows 10 його " +
                "можна встановити з офіційної сторінки Microsoft:\n" +
                "https://developer.microsoft.com/microsoft-edge/webview2/",
                "SExtract — помилка запуску",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
        finally
        {
            UseWaitCursor = false;
        }
    }

    private void ExtractWebAssets()
    {
        Directory.CreateDirectory(_webRoot);
        ExtractResource("SExtract.Desktop.Assets.index.html", "index.html");
        ExtractResource("SExtract.Desktop.Assets.script.js", "script.js");
        ExtractResource("SExtract.Desktop.Assets.style.css", "style.css");
        ExtractResource("SExtract.Desktop.Assets.favicon.ico", "favicon.ico");
    }

    private void ExtractResource(string resourceName, string fileName)
    {
        using Stream resource = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                $"Вбудований файл {fileName} не знайдено.");

        string targetPath = Path.Combine(_webRoot, fileName);
        using FileStream output = File.Create(targetPath);
        resource.CopyTo(output);
    }

    private void HandleDownloadStarting(
        object? sender,
        CoreWebView2DownloadStartingEventArgs e)
    {
        string suggestedName = Path.GetFileName(e.DownloadOperation.ResultFilePath);
        if (string.IsNullOrWhiteSpace(suggestedName))
            suggestedName = "audio.wav";

        using var dialog = new SaveFileDialog
        {
            Title = "Зберегти аудіофайл",
            FileName = suggestedName,
            Filter = "Аудіофайл WAV (*.wav)|*.wav|Усі файли (*.*)|*.*",
            DefaultExt = "wav",
            AddExtension = true,
            OverwritePrompt = true,
            RestoreDirectory = true
        };

        string downloads = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "Downloads");
        if (Directory.Exists(downloads))
            dialog.InitialDirectory = downloads;

        e.Handled = true;
        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            e.ResultFilePath = dialog.FileName;
        }
        else
        {
            e.Cancel = true;
        }
    }
}
