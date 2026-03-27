const NAME_REGEX = /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?\/[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const SCOPE_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function isValidFullName(name: string): boolean {
  return NAME_REGEX.test(name);
}

export function isValidScope(scope: string): boolean {
  return SCOPE_REGEX.test(scope);
}

export function parseFullName(fullName: string): { scope: string; name: string } | null {
  if (!isValidFullName(fullName)) return null;
  const withoutAt = fullName.slice(1); // remove @
  const slashIdx = withoutAt.indexOf("/");
  return {
    scope: withoutAt.slice(0, slashIdx),
    name: withoutAt.slice(slashIdx + 1),
  };
}

export function formatFullName(scope: string, name: string): string {
  return `@${scope}/${name}`;
}
