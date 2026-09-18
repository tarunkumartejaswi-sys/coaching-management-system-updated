# One-time deployment

1. Put these files directly in the GitHub repository root.
2. In Vercel, keep Root Directory empty and Framework = Vite.
3. Build Command: `npm run build`. Output Directory: `dist`.
4. Redeploy. Node 24 is selected by package.json.
5. If Firestore rules are changed, deploy only the rules separately with Firebase CLI: `firebase deploy --only firestore:rules`.

This package intentionally has no legacy `export const config = { runtime: "nodejs20.x" }` in the API function and no nested api/package.json. Vercel automatically deploys files in `/api` as Node.js Functions.
