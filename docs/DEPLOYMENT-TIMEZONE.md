# Deployment Timezone Configuration

**CRITICAL REQUIREMENT:** This application must be run with the system timezone set to `Asia/Kolkata` (IST).

## Why this is required
The analytics dashboard, period comparisons, and growth metrics rely entirely on the Node.js process's local timezone (via `new Date()` and `.setHours()`). The backend date range logic groups data by "days" in the server's local time.

## What breaks if it's not set
If the server defaults to UTC (as is standard in AWS, Docker, and most cloud environments), "today" will end at 5:30 AM IST of the following day. 
- Date range queries will drop IST-midnight-adjacent data on UTC servers.
- A payment processed at 5:00 AM IST on Tuesday will be recorded under Monday in the analytics dashboard.
- Nightly cron jobs or periodic reporting queries will run 5.5 hours late.

## Examples of how to set TZ=Asia/Kolkata

### 1. Dockerfile
Add the following `ENV` directive before the start command:
```dockerfile
ENV TZ=Asia/Kolkata
```

### 2. Systemd Service
If running directly on a Linux VM, add it to your `.service` file under `[Service]`:
```ini
[Service]
Environment="TZ=Asia/Kolkata"
```

### 3. PM2 Ecosystem File
In `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: "nsi-backend",
    script: "dist/main.js",
    env: {
      TZ: "Asia/Kolkata"
    }
  }]
}
```

### 4. Local Development (.env)
Add it to your `.env` file (if your framework auto-loads it into process.env before initialization):
```env
TZ=Asia/Kolkata
```

## How to verify it's set
Run the following command on your production server or inside your running Docker container:
```bash
node -e "console.log(new Date().toString())"
```
The output should explicitly state the IST offset, for example: `Tue Apr 21 2026 09:45:00 GMT+0530 (India Standard Time)`.
