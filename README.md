# COURT//RR — Ranked Basketball Missions

A complete **static, no-login Progressive Web App** for iPhone (including iPhone 13), with 23 exercises, 9 workout tiers, 25 competitive ranks, indoor rain replacements, tap counters, group check-off, daily RR/streak accounting, and browser-local backups. No Node, database, framework, build system, or paid service is needed to deploy it.

## Deploy from a ZIP to GitHub Pages

1. Download and **unzip** `court-rr-pwa.zip`. Do not upload the ZIP itself as the website.
2. Sign in to [github.com](https://github.com), create a new **public** repository (e.g. `court-rr`), and choose **Create repository**. Do **not** initialise it with a README (the download already has one).
3. In the repository choose **Add file → Upload files**. Upload the unzipped project's **contents**, including `index.html`, `app.js`, `style.css`, `data.js`, `manifest.webmanifest`, `sw.js`, `assets/`, `scripts/`, and `.github/workflows/deploy.yml`. GitHub's web uploader sometimes hides dotfolders: ensure `.github/workflows/deploy.yml` appears in the uploaded file list. If it does not, add it with **Add file → Create new file** and enter `.github/workflows/deploy.yml`, then paste the supplied workflow file text.
4. Commit changes on the `main` branch.
5. Go to **Settings → Pages**. Under **Build and deployment**, choose **Source: GitHub Actions**.
6. Open the **Actions** tab. The `Deploy COURT RR PWA` workflow should run. If not, choose the workflow → **Run workflow**. Wait for the green completion tick. On the first run, GitHub may ask to enable Actions.
7. Return to **Settings → Pages**. Your URL will be `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` (replace both placeholders). Open that actual URL.
8. On iPhone 13, open the site in **Safari** → tap **Share** → **Add to Home Screen** → **Add**. Open the new COURT//RR Home Screen icon for the standalone app.

**Alternative deploy without Actions:** If the Pages workflow is blocked by your GitHub settings, select **Deploy from a branch → main → / (root)** in Settings → Pages. This will publish the complete app too, but will keep bundled fallback rank artwork rather than downloading the official artwork during the build.

## Rank artwork

`assets/ranks/` includes **25 transparent backup emblems** so the app works even offline. In GitHub Actions, `scripts/fetch_ranks.py` attempts to download the **25 exact image URLs supplied in the brief**, then flood-removes corner-connected solid backgrounds and substitutes the processed rank PNGs for the fallback emblems in the deployed website. A remote wiki failure leaves the transparent fallbacks intact. Original images are the property of their rights holders; this is an unofficial personal training project, not affiliated with Riot Games. If you have rights or permission constraints, keep the included original placeholder emblems.

You can fetch and process the official images locally with Python 3:

```bash
pip install pillow
python scripts/fetch_ranks.py
```

Afterward, upload the updated `assets/ranks/` folder to GitHub. Github-hosted website files and sprites are cached for offline use after the initial visit. The original wiki URLs are not required at runtime.

## How workouts, RR and ranks work

- **Every day** has six morning drills, plus Monday upper (2), Tuesday lower (4), Wednesday upper + lower (6), Thursday match (1), Friday recovery (1), Saturday skills (5), Sunday finishing (4).
- There are **nine workout tiers**: Iron, Bronze, Silver, Gold, Platinum, Diamond, Ascendant, Immortal, Radiant. Each tier has its prescriptions from the uploaded plan (including the special defence drill). The 1–3 subdivisions share the prescription of their parent tier.
- Reward per checked complete exercise: **morning 7 RR, upper 15, lower 13, match 20, recovery 12, Saturday/Sunday 14**. In addition, a **completed full day's mission** pays +18 RR plus +2 RR per continuous successful day, up to an additional +28 RR.
- **An incomplete day** incurs −10 RR the first time, −20 the second consecutive missed day, −40 on the third, etc. The per-day doubling is safety-capped at **−167,772,160 RR** after 25 consecutive missed days to protect calculations. Partial workout points count, but **only a full mission protects the streak**.
- Historical daily performance is calculated from stored completion state, **not by incrementally adding points when you tap**: toggling back and forth cannot farm RR. A missed day receives its penalty only once when it passes, rather than on every app opening. You can only edit today's workout, not past workouts.
- The rank is determined by **net RR**, so repeated absences can demote you. The ladder's Radiant threshold is **37,876 RR**. Your day's selected workout difficulty is frozen when that date's plan is first created, so rank changes from today's completion won't silently change today's goals.
- A workout may be marked complete directly, in its **exercise checkbox**, or through **Finish all** for a whole group. Tapping an exercise expands a rep/seconds counter with +1 and, for large goals, +5/+10. **Counter progress by itself does not grant points** until the full exercise is checked; this matters for prescriptions with multiple components. Counted primary targets are approximations for compound instructions: always read the entire prescription.
- Switching weather has an **indoor option** for court drills on Saturday and Sunday, a Thursday rain alternative, and keeps separate dry/rain progress on the affected exercise. Only one variant of each exercise counts for RR at a time.

## Important caveats

- **No login means no automatic cloud sync**. Local progress is saved by the installed app/browser in `localStorage`. Clearing browser website data, switching the URL/repository, removing the app, or changing phones can lose it. Use **Settings → Export backup** periodically, and import JSON to restore.
- **Notifications and automatic weather detection** are intentionally omitted. Choose dry/rain manually to avoid external services and location permissions.
- Because this is offline-first and login-free, **dates and results are client-controlled**, and therefore not cheat-proof. The app handles missed dates when it is next opened, but cannot independently verify reps, injuries, or device-clock changes.
- Safety: don't do full-speed jumps on wet/slippery surfaces; choose lower-impact indoor alternatives as needed. The source plan includes advanced plyometrics and loaded drills; use appropriate space, technique, and personal judgement.
- This is a personal training tracker, not official competitive RR or a medical programme.

## Files

| File | Purpose |
|---|---|
| `index.html` | PWA entry point |
| `style.css` | Mobile iPhone-first styling |
| `app.js` | Missions, counters, RR, streaks, ranks, backups |
| `data.js` | All 23 exercises × 9 rank tier prescriptions and rank image URLs |
| `manifest.webmanifest` | App name, Home Screen icon and standalone mode |
| `sw.js` | Service-worker offline caching |
| `assets/` | App icons and 25 transparent fallback rank PNGs |
| `.github/workflows/deploy.yml` | One-click GitHub Pages deployment and rank PNG processing |
| `scripts/fetch_ranks.py` | Download specified rank PNGs and remove flat background |
