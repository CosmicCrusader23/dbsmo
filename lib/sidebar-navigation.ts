export type SidebarNavLink = {
  href: string;
  label: string;
  icon: string;
  match?: string;
};

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "");
}

function matchesPath(pathname: string, matchPath: string): boolean {
  const normalizedPathname = normalizePath(pathname);
  const normalizedMatchPath = normalizePath(matchPath);
  return (
    normalizedPathname === normalizedMatchPath ||
    (normalizedMatchPath !== "/" && normalizedPathname.startsWith(`${normalizedMatchPath}/`))
  );
}

export function activeSidebarHref(pathname: string, links: SidebarNavLink[]): string | null {
  const normalizedPathname = normalizePath(pathname);
  let activeHref: string | null = null;
  let activeScore = -1;

  for (const link of links) {
    const matchPath = normalizePath(link.match ?? link.href);
    if (!matchesPath(normalizedPathname, matchPath)) continue;

    const isExactDestination = normalizedPathname === normalizePath(link.href);
    const score = matchPath.length + (isExactDestination ? 10_000 : 0);
    if (score > activeScore) {
      activeHref = link.href;
      activeScore = score;
    }
  }

  return activeHref;
}
