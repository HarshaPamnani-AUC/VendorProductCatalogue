module.exports = {
  apps: [
    {
      name: 'vendorpro-backend',
      script: './server.js',
      cwd: '/var/www/vendorpro.beautystorellc.com',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/www/vendorpro.beautystorellc.com/logs/backend-error.log',
      out_file: '/var/www/vendorpro.beautystorellc.com/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      restart_delay: 4000,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'public'],
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'vendorpro-frontend',
      script: 'node_modules/.bin/next',
      args: 'start --port 3000 --hostname 0.0.0.0',
      cwd: '/var/www/vendorpro.beautystorellc.com',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/vendorpro.beautystorellc.com/logs/frontend-error.log',
      out_file: '/var/www/vendorpro.beautystorellc.com/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      restart_delay: 4000,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'public'],
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],
  deploy: {
    production: {
      user: 'wholesaleadmin',
      host: 'vendorpro.beautystorellc.com',
      ref: 'origin/main',
      repo: 'https://github.com/HarshaPamnani-AUC/VendorProductCatalogue.git',
      path: '/var/www/vendorpro.beautystorellc.com',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
