module.exports = {
  apps: [
    {
      name: 'skill-hub-backend',
      cwd: '/home/yaxon/skill-hub/backend',
      script: 'server.js',
      env: {
        PORT: 8080,
        DB_HOST: 'localhost',
        DB_USER: 'skillhub',
        DB_PASSWORD: 'skillhub123',
        DB_NAME: 'skill_hub'
      },
      watch: false,
      autorestart: true,
      restart_delay: 3000
    },
    {
      name: 'skill-hub-frontend',
      cwd: '/home/yaxon/skill-hub/frontend',
      script: 'npm',
      args: 'run dev',
      env: {
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      restart_delay: 3000
    }
  ]
}