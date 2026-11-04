// How many proxies sit in front of the API: TRUSTED_PROXY_HOPS, a whole number, 0 when unset.
// Render's proxy is 1; the shop's rewrite in front of it makes 2.
export function trustedProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const value = (env["TRUSTED_PROXY_HOPS"] ?? "").trim();
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `TRUSTED_PROXY_HOPS has "${value}": use a whole number, the proxies in front of the API`,
    );
  }
  return Number(value);
}

// Fastify's trustProxy: the address Fastify sees (hop 0) and the X-Forwarded-For entries added by
// the next proxies are trusted, up to `hops`, so request.ip is the first address a trusted proxy
// saw. With 0 the header is ignored and nobody can fake their address. (A plain number is not
// used: Fastify 5 treats it as "trust nothing".)
export function trustProxy(hops: number): (address: string, hop: number) => boolean {
  return (_address, hop) => hop < hops;
}
