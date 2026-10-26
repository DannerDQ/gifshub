export const trustedOrigins = async function (): Promise<
  (string | null | undefined)[]
> {
  const env = process.env.VERCEL_ENV;

  if (!env || env === "development") return [];
  if (env === "production")
    return ["https://gifshub-*-2023101351-7856s-projects.vercel.app"];

  const branch = process.env.VERCEL_BRANCH_URL;

  return [
    `https://${process.env.VERCEL_URL}`,
    branch ? `https://${branch}` : undefined,
  ];
};
