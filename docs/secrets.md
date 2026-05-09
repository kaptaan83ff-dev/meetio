# GitHub Repository Secrets

The following secrets must be configured in your GitHub repository (`Settings > Secrets and variables > Actions`) for the CI/CD pipeline to function.

## 1. Database
- `MONGODB_URI_PRODUCTION`: The MongoDB Atlas connection string for your production cluster. Used by the `migrate` job.

## 2. Railway (Backend)
- `RAILWAY_TOKEN`: Your Railway API token.
  - Obtain from: Railway Dashboard > Account Settings > Tokens.

## 3. Cloudflare (Frontend)
- `CLOUDFLARE_API_TOKEN`: A Cloudflare API token with `Cloudflare Pages: Edit` permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.
  - Obtain from: Cloudflare Dashboard > Workers & Pages > Overview (sidebar).

## 4. Other App Config (Optional for CI)
If your integration tests require other services, you may need:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- etc.

> [!IMPORTANT]
> Ensure that your MongoDB Atlas "Network Access" allows connections from GitHub Actions IP ranges, or use a specific whitelist if you have a proxy.
