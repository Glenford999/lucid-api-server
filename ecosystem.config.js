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
      max_restarts: 3,
      min_uptime: "10s",
      instances: 1,
      exp_backoff_restart_delay: 1000,
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production"
      },
      exec_mode: "fork",
      wait_ready: true,
      shutdown_with_message: true,
      kill_retry_time: 3000
    }
  ]
}; 