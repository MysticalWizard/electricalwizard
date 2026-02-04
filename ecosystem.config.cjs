module.exports = {
  apps: [
    {
      name: 'electricalwizard',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',
      env_file: '.env',
      watch: false,
    },
  ],
};
