# Local Development

## App

```powershell
npm run dev
```

Copy `.env.example` to `.env` and fill in local values when database, AI, or
phone-transfer settings are needed. `APP_ACCESS_PASSWORD` can stay unset during
local development.

For phone transfer testing from another device on the same network:

```powershell
$env:NEXT_PUBLIC_PAP_PUBLIC_URL="http://YOUR_DESKTOP_IP:3000"
npm run dev -- -H 0.0.0.0
```

## PAP Signaling

Run in a second terminal:

```powershell
npm run pap:signal
```

If a phone can open the web app but cannot connect to PAP, verify that port
`3001` is reachable from the phone.
