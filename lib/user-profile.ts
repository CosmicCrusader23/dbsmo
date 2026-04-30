export function usernameFromEmail(email: string): string {
  const [username = "user"] = email.trim().toLowerCase().split("@");
  return username || "user";
}

export function profilePathFromEmail(email: string): string {
  return `/users/${encodeURIComponent(usernameFromEmail(email))}`;
}
