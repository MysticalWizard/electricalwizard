module.exports = {
  apps: [
    {
      name: 'electricalwizard',
      script: './dist/main.js',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
