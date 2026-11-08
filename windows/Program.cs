namespace SExtract.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(
            initiallyOwned: true,
            name: @"Local\SExtract.Desktop.SingleInstance",
            createdNew: out bool isFirstInstance);

        if (!isFirstInstance)
        {
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
