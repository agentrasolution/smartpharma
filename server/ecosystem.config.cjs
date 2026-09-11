module.exports = {
  apps: [{
    name: "faraz-pharmacy-api",
    script: "dist/server.js",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
    },
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 4000,
  }],
};
