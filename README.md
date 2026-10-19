# WRLDSI

The WRLDSI website is a bilingual, responsive static site. It has no build step or package dependencies.

The information and draft legal notices are available at `legal.html`. Cookie preferences are managed in the browser; optional Google Fonts are loaded only after consent. Review the KVKK notice and terms with the responsible party's verified details before publishing.

## Preview

Run `node server.js` (or `npm start`) and open http://localhost:3000. Set the `PORT` environment variable to use another port.

## News updates

The homepage reads reviewed items from `articles.json`. The configured publisher and research feeds are listed in `content/news-sources.json`; a daily GitHub Actions workflow collects their latest RSS items and opens or updates a pull request for editorial review. The workflow does not publish directly. Review source links and publisher-provided summaries, then merge approved changes.

The workflow uses only GitHub-hosted runners; it does not run a news collector on the WRLDSI server. To activate it, put the project in a GitHub repository with Actions enabled and allow GitHub Actions to create pull requests. The schedule runs daily at 03:17 UTC, and it can also be started manually from the Actions tab. New items appear on the live site after approval and deployment with `.\deploy.ps1 -Target test` followed by `.\deploy.ps1 -Target prod`.

Summaries initially come from each publisher's RSS feed, not from an AI model. Editorial `summary` fields added during review are preserved by later updates. Check each source's reuse terms before publishing excerpts.

## Publish to the WRLDSI VPS

The site is served by nginx from `/var/www/wrldsi`; the protected preview is served from `/var/www/wrldsi-test`. SSH access must be configured for `root@37.148.211.222`.

From PowerShell in this folder:

1. Deploy to the password-protected preview: `.\deploy.ps1 -Target test`
2. Review `https://test.wrldsi.com`.
3. After approval, deploy to the live site: `.\deploy.ps1 -Target prod` and type `evet` when prompted. For an already approved, non-interactive deployment, add `-ConfirmLive`.

The script uploads the required static site files and verifies each remote file with SHA-256. It does not delete remote files. Test credentials are managed separately and are not stored in this repository.

Keep `wrldsi.com` as the canonical domain. Configure any alternate domains, such as `wrldsi.net` or `wrldsi.org`, to permanently redirect to `https://wrldsi.com/`.
