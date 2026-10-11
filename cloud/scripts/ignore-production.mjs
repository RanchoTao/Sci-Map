// Vercel Git previews may build automatically. Production requires a separately
// reviewed, manual release after real GitHub OAuth and repository-access E2E.
// Vercel's ignored-build convention: 0 skips, 1 builds.
process.exit(process.env.VERCEL_ENV === 'preview' ? 1 : 0);
