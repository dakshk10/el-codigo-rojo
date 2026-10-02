# CODEVERSE 2.0 — EL CÓDIGO ROJO
## Organiser Runbook

This document explains how to deploy and operate El Código Rojo on Vercel + Neon Postgres.

### 1. Prerequisites
- A Vercel account
- A GitHub account with access to this repository

### 2. Deployment Steps
1. **Import Project to Vercel**: 
   - Go to the Vercel dashboard and click **Add New... > Project**.
   - Import the `el-codigo-rojo` repository.
   - Vercel should auto-detect the Vite framework for the client, but our `vercel.json` and Root directory config handles the build. Keep the Root Directory at the repository root.
   - Set Build Command to `npm run build` and Output Directory to `client/dist` (or just leave defaults if Vercel reads `package.json` correctly, but we have `vercel.json` which routes things properly).

2. **Connect Neon Database**:
   - In the Vercel project dashboard, go to the **Storage** tab.
   - Click **Connect Store** and choose **Neon Postgres**.
   - Follow the flow to provision a Neon database in the same region as your Vercel deployment.
   - This automatically adds `DATABASE_URL` to your Vercel environment variables.

3. **Set Environment Variables**:
   - Go to **Settings > Environment Variables**.
   - Add the following variables (for Production and Preview):
     - `ADMIN_TOKEN`: A secure secret string used to access the `/admin` dashboard.
     - `EVENT_CODE`: The code players must enter on the first screen (e.g., `THE-MINT-2026`).
     - `NODE_ENV`: Set to `production`.
   
4. **Run Database Migrations**:
   - Migrations are in `server/migrations/`.
   - You can connect to your Neon database using `psql` or a visual client (like DBeaver or Neon's online SQL editor) using the `DATABASE_URL`.
   - Execute the contents of `server/migrations/001_initial.sql` followed by `002_gateway.sql` (if any).
   - *Note: In a more automated setup, you could run a script `npm run migrate`, but for this setup, applying them via the Neon SQL Editor is the easiest.*

5. **Deploy**:
   - Trigger a deployment in Vercel if one hasn't already built successfully.
   - Verify the deployment is reachable at the Vercel-provided URL.

### 3. Running the Event
- **Share the URL**: Give teams the Vercel URL (e.g., `https://el-codigo-rojo.vercel.app`).
- **Share the Event Code**: Reveal the `EVENT_CODE` at the event start time. Teams enter this to access the team entry screen.
- **Admin Dashboard**:
  - Visit `https://[your-url]/#admin`.
  - Enter the `ADMIN_TOKEN`.
  - Here you can monitor live team progress, scores, and timer statuses.

### 4. Operations & Troubleshooting
- **Resetting a Team**: If a team completely messes up or experiences a fatal issue, you can click **RESET** in the Admin Dashboard. This clears their session state back to `NOT_STARTED` while preserving their team name and passcode.
- **Rolling Back**: If a mid-event deployment causes issues, go to the Vercel Deployments tab, click the three dots on the previous successful deployment, and select **Promote to Production** (or **Redeploy**).
- **Exporting Results**: At the end of the event, click **EXPORT CSV** in the Admin Dashboard to download the final scores for integration with the global CODEVERSE leaderboard.

### 5. Load Testing (Optional)
Before the event, you can run the load test against your deployment to verify capacity:
```bash
EVENT_CODE=your-code LOAD_TEST_URL=https://your-preview-url.vercel.app node scripts/load-test.mjs
```
