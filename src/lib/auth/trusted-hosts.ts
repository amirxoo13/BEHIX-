/** Hostnames for Better Auth `allowedHosts`. Port is not part of the host. */
export function trustedOriginHosts(origins: readonly string[]): string[] {
  const hosts: string[] = [];
  for (const origin of origins) {
    try {
      const host = new URL(origin).hostname;
      if (host) hosts.push(host);
    } catch {
      /* not an origin */
    }
  }
  return hosts;
}
