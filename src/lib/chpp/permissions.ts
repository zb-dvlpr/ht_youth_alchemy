export const CHPP_PERMISSION_FLOW_VERSION = "1";
export const CHPP_PERMISSION_FLOW_SESSION_VERSION = 1;
export const CHPP_PERMISSION_FLOW_QUERY_PARAM = "permissionFlowVersion";
export const CHPP_PERMISSION_FLOW_COOKIE = "chpp_permission_flow";

export const MANDATORY_CHPP_EXTENDED_PERMISSIONS = [
  "manage_youthplayers",
] as const;

export const OPTIONAL_CHPP_EXTENDED_PERMISSIONS = [
  "place_bid",
  "set_matchorder",
  "set_training",
] as const;

export const REQUESTED_CHPP_EXTENDED_PERMISSIONS = [
  ...MANDATORY_CHPP_EXTENDED_PERMISSIONS,
  ...OPTIONAL_CHPP_EXTENDED_PERMISSIONS,
] as const;

export type OptionalChppExtendedPermission =
  (typeof OPTIONAL_CHPP_EXTENDED_PERMISSIONS)[number];

export const OPTIONAL_CHPP_PERMISSION_OPTIONS = [
  {
    permission: "place_bid",
    labelKey: "chppPermissionPlaceBidLabel",
    descriptionKey: "chppPermissionPlaceBidDescription",
  },
  {
    permission: "set_matchorder",
    labelKey: "chppPermissionSetMatchOrderLabel",
    descriptionKey: "chppPermissionSetMatchOrderDescription",
  },
  {
    permission: "set_training",
    labelKey: "chppPermissionSetTrainingLabel",
    descriptionKey: "chppPermissionSetTrainingDescription",
  },
] as const satisfies ReadonlyArray<{
  permission: OptionalChppExtendedPermission;
  labelKey: string;
  descriptionKey: string;
}>;

export const CHPP_PERMISSION_ALIASES: Record<string, readonly string[]> = {
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
  set_training: [
    "set_training",
    "settraining",
    "set_trainingtype",
    "training",
  ],
  place_bid: [
    "place_bid",
    "placebid",
    "bid",
    "place_bidamount",
  ],
};

export function isOptionalChppExtendedPermission(
  value: string
): value is OptionalChppExtendedPermission {
  return OPTIONAL_CHPP_EXTENDED_PERMISSIONS.includes(
    value as OptionalChppExtendedPermission
  );
}

export function normalizeOptionalChppPermissions(
  values: readonly string[]
): OptionalChppExtendedPermission[] {
  const requested = new Set(
    values.map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
  return OPTIONAL_CHPP_EXTENDED_PERMISSIONS.filter((permission) =>
    requested.has(permission)
  );
}

export function buildRequestedChppPermissions(
  optionalPermissions: readonly string[]
) {
  return [
    ...MANDATORY_CHPP_EXTENDED_PERMISSIONS,
    ...normalizeOptionalChppPermissions(optionalPermissions),
  ];
}

export function toChppScopeParam(permissions: readonly string[]) {
  return Array.from(
    new Set(
      permissions.map((permission) => permission.trim().toLowerCase()).filter(Boolean)
    )
  ).join(",");
}

export function buildChppScopeParam(
  selectedOptionalPermissions: readonly string[]
) {
  return toChppScopeParam(
    buildRequestedChppPermissions(selectedOptionalPermissions)
  );
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
  requiredPermissions: readonly string[] = MANDATORY_CHPP_EXTENDED_PERMISSIONS
) {
  const granted = new Set(
    grantedPermissions.map((permission) => permission.trim().toLowerCase())
  );
  return requiredPermissions.filter((permission) => {
    const accepted = CHPP_PERMISSION_ALIASES[permission] ?? [permission];
    return !accepted.some((alias) => granted.has(alias));
  });
}

export function hasChppPermission(
  grantedPermissions: readonly string[],
  permission: string
) {
  return getMissingChppPermissions(grantedPermissions, [permission]).length === 0;
}
