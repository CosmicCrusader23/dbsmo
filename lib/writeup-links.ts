export function writeupPostId(writeupId: string) {
  return `writeup-${writeupId}`;
}

export function writeupPostHref(problemSetSlug: string, writeupId: string) {
  return `/problem-sets/${problemSetSlug}/writeups#${writeupPostId(writeupId)}`;
}
