// ============================================================
// Mentalaba AI Agent — BACKEND (aiagent) uchun PM2 config
// ============================================================
// Ishga tushirish:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup            (server qayta ishga tushganda avto)
// Loglarni ko'rish:
//   pm2 logs mentalaba-aiagent
//   pm2 monit
// ============================================================

module.exports = {
  apps: [
    {
      name: "mentalaba-aiagent",
      // `npm run start` o'rniga to'g'ridan-to'g'ri Next.js bin — Windows/Linux
      // ikkalasida ham ishlaydi va npm shell muammolarini oldini oladi.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Yiqilganda 3 soniya kutib qayta ishga tushadi
      restart_delay: 3000,
    },
  ],
};
