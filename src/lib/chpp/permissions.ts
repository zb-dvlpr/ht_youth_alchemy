export const REQUIRED_CHPP_EXTENDED_PERMISSIONS = [
  "set_matchorder",
  "manage_youthplayers",
] as const;

const CHPP_PERMISSION_ALIASES: Record<string, readonly string[]> = {
  set_matchorder: [
    "set_matchorder",
    "setmatchorder",
    "set_matchorders",
    "matchorders",
  ],
  manage_youthplayers: [
    "manage_youthplayers",
    "manageyouthplayers",
    "manage_youthplayer",
    "unlockskills",
    "youthplayers",
  ],
};

export function toChppScopeParam(
  permissions: readonly string[] = REQUIRED_CHPP_EXTENDED_PERMISSIONS
) {
  return permissions.join(",");
}

export function parseExtendedPermissionsFromCheckToken(raw: string) {
  const matches = Array.from(
    raw.matchAll(
      /<(ExtendedPermissions|Scope|Permissions)>([^<]*)<\/(ExtendedPermissions|Scope|Permissions)>/gi
    )
  );
  const values = matches.map((match) => match[2]?.trim() ?? "").filter(Boolean);
  if (values.length === 0) return [] as string[];

  return values
    .join(" ")
    .split(/[,\s;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getMissingChppPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[] = REQUIRED_CHPP_EXTENDED_PERMISSIONS
) {
  const granted = new Set(
    grantedPermissions.map((permission) => permission.trim().toLowerCase())
  );
  return requiredPermissions.filter((permission) => {
    const accepted = CHPP_PERMISSION_ALIASES[permission] ?? [permission];
    return !accepted.some((alias) => granted.has(alias));
  });
}
