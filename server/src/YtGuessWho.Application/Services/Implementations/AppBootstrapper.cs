using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace YtGuessWho.Application.Services.Implementations;

/// <summary>
/// Hosted service responsible for application lifecycle logging.
/// Writes startup and shutdown log entries when the application starts and stops.
/// </summary>
internal sealed class AppBootstrapper(ILogger<AppBootstrapper> logger) : IHostedService
{
    private readonly ILogger<AppBootstrapper> _logger = logger;

    /// <summary>
    /// Called when the application host is ready to start the service.
    /// Logs an informational message confirming the server is up and running.
    /// </summary>
    /// <param name="cancellationToken">Triggered if the host decides to abort the start operation.</param>
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Server application is up and running");
        return Task.CompletedTask;
    }

    /// <summary>
    /// Called when the application host is performing a graceful shutdown.
    /// Logs an informational message confirming the shutdown has been initiated.
    /// </summary>
    /// <param name="cancellationToken">Triggered if the shutdown operation exceeds the configured timeout.</param>
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping server application...");
        return Task.CompletedTask;
    }
}