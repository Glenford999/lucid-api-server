module.exports = {
  apps: [
    {
      name: "health-server",
      script: "health.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      instances: 1,
      exp_backoff_restart_delay: 100
    },
    {
      name: "api-server",
      script: "server.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      instances: 1,
      exp_backoff_restart_delay: 100
    }
  ]
}; 