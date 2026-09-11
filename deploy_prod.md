# Faraz Pharmacy POS — Production Deployment

## Architecture

```
                    SERVER MACHINE
             (Server + optional POS Client)

          ┌──────────────────────────┐
          │ PostgreSQL (port 5433)   │
          │ Express API (port 3001)  │
          │ PM2 process manager      │
          │ pg_dump backups          │
          │ Electron POS App (opt.)  │
          └───────────┬──────────────┘
                      │
                 LAN (ethernet)
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼

      Client 1    Client 2    Client 3
      Electron    Electron    Electron
      POS App     POS App     POS App
```

- **Server machine** — PostgreSQL + Express API managed by **PM2**.
  May also run the Electron POS client for local use.
- **Client machines** — run only the Electron POS app, connected via LAN.

---

## 1. Server Machine — Prerequisites

| Component  | Version | Install                                        |
| ---------- | ------- | ---------------------------------------------- |
| Node.js    | 22 LTS  | [nodejs.org](https://nodejs.org)               |
| PostgreSQL | 16+     | [postgresql.org](https://www.postgresql.org)   |
| Git        | any     | [git-scm.com](https://git-scm.com)             |

> **Important**: Set PostgreSQL port to **5433** during installation (our .env
> uses 5433). If you use the default 5432, you must update `.env` accordingly.

During PostgreSQL setup:
```
Username: postgres
Password: <choose a strong password>
Port:     5433      ← NOT the default 5432
```

---

## 2. Create the Database

Open SQL Shell (psql):

```sql
CREATE DATABASE "faraz-pharmacy";
```

Verify:

```sql
\l
```

---

## 3. Install the Server Application

Extract or clone the server package to a stable location:

```
C:\FarazPharmacy\          (Windows)
/opt/faraz-pharmacy/       (macOS/Linux)

├── server          ← Node.js Express API
├── backups         ← pg_dump output
└── logs            ← application logs
```

```bash
cd /path/to/project
git clone <repo-url> server
# or copy the server folder manually
```

---

## 4. Configure Environment

Create `/path/to/server/.env`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5433/faraz-pharmacy"

JWT_SECRET="replace-with-a-long-random-secret-at-least-32-chars"

PORT=3001

NODE_ENV=production
```

> `JWT_SECRET` must be unique per deployment. Generate one:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. Install Dependencies & Generate Prisma Client

```bash
cd /path/to/server

npm install

npx prisma generate
```

---

## 6. Database Migrations

Since there are no committed migration files yet, initialise them on a
development machine first:

```bash
cd server
npx prisma migrate dev --name init
```

This creates `prisma/migrations/`. Commit and push these files. Then on the
**production server**:

```bash
npx prisma migrate deploy
```

> If you prefer not to track migration history, use instead:
> ```bash
> npx prisma db push
> ```

---

## 7. Seed Initial Data

```bash
npm run db:seed
```

Creates the admin account:

```
Username: admin
Password: admin123
```

> Change the password immediately after first login via
> Settings → Change Password or use the recovery key flow.

---

## 8. Keep the Server Always Running with PM2

**PM2** is a process manager that keeps your server alive forever. If it crashes,
PM2 restarts it. If the computer reboots, PM2 starts it again automatically.

### 8a. Install PM2

```bash
npm install -g pm2
```

### 8b. Start the Server with PM2

```bash
cd /path/to/server
pm2 start ecosystem.config.cjs
```

That's it. The server is now running in the background.

Check if it's running:

```bash
pm2 status
```

You should see `faraz-api` with status `online`.

Test the API:

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-07-05T..."}
```

### 8c. Save the Process List

This tells PM2 to remember which apps to restart:

```bash
pm2 save
```

### 8d. Enable Auto-Start on Reboot

**On macOS:**

```bash
pm2 startup
```

PM2 will print a command. Copy-paste and run it (it needs `sudo`).

**On Windows:**

Open PowerShell as **Administrator** and run:

```powershell
pm2 startup
```

PM2 will print a command. Run that command.

---

## 9. Configure Windows Firewall (Windows Only)

Allow inbound traffic on port 3001 so client machines can reach the API.

PowerShell as Administrator:

```powershell
New-NetFirewallRule `
  -DisplayName "Faraz Pharmacy API" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3001 `
  -Action Allow
```

---

## 10. Automatic Database Backups

Create the backup directory:

```
/path/to/backups/
```

### macOS / Linux Backup Script

Create `/path/to/backups/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
FILENAME="faraz-pharmacy-$(date +%Y%m%d-%H%M).sql"
pg_dump -U postgres -d faraz-pharmacy > "$BACKUP_DIR/$FILENAME"
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete
```

Make it executable:

```bash
chmod +x /path/to/backups/backup.sh
```

Schedule with cron:

```bash
crontab -e
```

Add this line (runs daily at 2 AM):

```
0 2 * * * /path/to/backups/backup.sh
```

### Windows Backup Script

Create `C:\FarazPharmacy\backups\backup.bat`:

```batch
@echo off
set BACKUP_DIR=C:\FarazPharmacy\backups
set FILENAME=faraz-pharmacy-%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%-%TIME:~0,2%%TIME:~3,2%.sql
set FILENAME=%FILENAME: =0%
"C:\Program Files\PostgreSQL\16\bin\pg_dump" -U postgres -d faraz-pharmacy > "%BACKUP_DIR%\%FILENAME%"
forfiles -p "%BACKUP_DIR%" -s -m *.sql -d -30 -c "cmd /c del @path"
```

> Adjust the PostgreSQL path if your version differs.

Schedule with Task Scheduler:

1. Open **Task Scheduler**
2. Create Task → name `FarazPharmacy Backup`
3. Trigger: **Daily** at 2:00 AM
4. Action: Start program → browse to `C:\FarazPharmacy\backups\backup.bat`
5. Run whether user is logged on or not

---

## 11. Build the Electron Client Installer

Run this on any machine with the full repo (development machine):

```bash
cd desktop-app
npm install
npm run build
```

This runs `vite build` then `electron-builder`, producing an installer in
`desktop-app/dist/`:

| Platform | Installer         |
| -------- | ----------------- |
| Windows  | `Faraz-*.exe`     |
| macOS    | `Faraz-*.dmg`     |
| Linux    | `Faraz-*.AppImage`|

Copy the installer to a USB drive for distribution.

---

## 12. Install on the Server Machine (Optional Client)

If the server machine also runs the POS client:

1. Run the installer (`Faraz-*.dmg` on macOS or `Faraz-*.exe` on Windows)
2. **First Launch** screen → click **Server Machine**
3. The app detects the local IP and shows it to you
4. Click **Continue to App**

Config saved:

```json
{"mode": "server", "serverUrl": "http://localhost:3001"}
```

The Electron app communicates with the local API over localhost.

---

## 13. Install on Client Machines

1. Run the installer
2. **First Launch** screen → click **Client Machine**
3. Enter the server machine's LAN IP (e.g. `192.168.1.100`)
4. Click **Connect**

Config saved:

```json
{"mode": "client", "serverUrl": "http://192.168.1.100:3001"}
```

---

## 14. Runtime URL Resolution

The `getApiUrl()` function in `desktop-app/src/lib/api.ts` resolves the
server URL in this order:

1. `window.appConfig.serverUrl` — set by First Launch (Electron only)
2. `VITE_API_URL` env var — set at build time
3. `http://localhost:3001` — development fallback

---

## 15. Server Maintenance

### Check Status

```bash
pm2 status
```

### View Logs

```bash
pm2 logs faraz-api
```

### Restart the API

```bash
pm2 restart faraz-api
```

### Stop the API

```bash
pm2 stop faraz-api
```

### Monitor CPU / Memory

```bash
pm2 monit
```

### Check Health

```bash
curl http://localhost:3001/api/health
```

---

## 16. Server Update Procedure

Before each update:

```
1. Backup database (pg_dump)
2. Stop: pm2 stop faraz-api
3. Update server files (git pull or replace files)
4. Run: npm install
5. Run: npx prisma generate
6. Run: npx prisma migrate deploy   (or npx prisma db push)
7. Run: npm run build
8. Start: pm2 start faraz-api
9. Verify: curl http://localhost:3001/api/health
```

---

## 17. Client Update Procedure

```bash
cd desktop-app
npm install
npm run build
```

Reinstall on each client machine. The config file and cache at
`~/.faraz-pharmacy/` (macOS/Linux) or `%USERPROFILE%\.faraz-pharmacy\`
(Windows) are preserved across reinstalls.

---

## 18. Production Checklist

### Server Machine

- [ ] PostgreSQL installed on port **5433**
- [ ] Database `faraz-pharmacy` created
- [ ] `.env` configured with strong `JWT_SECRET`
- [ ] `npm install` completed
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Migrations applied (`prisma migrate deploy` or `prisma db push`)
- [ ] Seed data inserted (`npm run db:seed`)
- [ ] Server built (`npm run build`)
- [ ] PM2 installed (`npm install -g pm2`)
- [ ] PM2 started (`pm2 start ecosystem.config.cjs`)
- [ ] PM2 saved (`pm2 save`)
- [ ] PM2 auto-start configured (`pm2 startup`)
- [ ] Firewall rule for port 3001 added (Windows only)
- [ ] Backup script created and scheduled
- [ ] Health endpoint responds (`curl http://localhost:3001/api/health`)
- [ ] Electron client installed (optional — if running POS on same machine)

### Client Machines

- [ ] Electron client installed
- [ ] First Launch: selected **Client Machine**
- [ ] Server IP entered correctly
- [ ] Login successful (admin/admin123)
- [ ] Products list loads
- [ ] Sales workflow tested (add item, checkout, print)
- [ ] Receipt printing tested



----
----


A static IP means the server machine always gets the same IP address (e.g., 192.168.1.100) instead of a different one each time it boots.
By default, most networks use DHCP — your router automatically assigns an IP, and it can change after a restart or when the lease expires. If that happens, all your client machines will try to connect to the old IP and fail.
Two ways to fix it:
1. Router setting (recommended) — In your router admin panel, find "DHCP Reservation" or "Static Lease." Assign a fixed IP to the server machine's MAC address. The server still uses DHCP, but the router always gives it the same IP.
2. On the machine itself — Manually set the IP in network settings. Less flexible — if you move the machine to a different network, it won't work until you change it back.


**On Windows:**
> Settings > Network & Internet > Ethernet > IP assignment → Edit → Manual

**On macOS:**
> System Settings > Network > (your connection) > Details > TCP/IP → Configure IPv4 → Manually