const LEMON_SQUEEZY_LICENSE_API_BASE = "https://api.lemonsqueezy.com/v1/licenses";

const API_KEY_ENV = "HT_ALCHEMY_LS_API_KEY";

type LemonSqueezyLicenseStatus = "inactive" | "active" | "expired" | "disabled";

type LemonSqueezyLicensePayload = {
  status?: LemonSqueezyLicenseStatus | null;
  key?: string | null;
  activation_limit?: number | null;
  activation_usage?: number | null;
  created_at?: string | null;
  expires_at?: string | null;
};

type LemonSqueezyInstancePayload = {
  id?: string | null;
  name?: string | null;
  created_at?: string | null;
};

type LemonSqueezyMetaPayload = {
  store_id?: number | null;
  order_id?: number | null;
  order_item_id?: number | null;
  product_id?: number | null;
  product_name?: string | null;
  variant_id?: number | null;
  variant_name?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
};

export type LemonSqueezyLicenseDetails = {
  status: LemonSqueezyLicenseStatus | null;
  key: string | null;
  activationLimit: number | null;
  activationUsage: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  instanceId: string | null;
  instanceName: string | null;
  instanceCreatedAt: string | null;
  storeId: number | null;
  orderId: number | null;
  orderItemId: number | null;
  productId: number | null;
  productName: string | null;
  variantId: number | null;
  variantName: string | null;
  customerId: number | null;
  customerName: string | null;
  customerEmail: string | null;
};

type LemonSqueezyValidationResponse = {
  valid?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicensePayload | null;
  instance?: LemonSqueezyInstancePayload | null;
  meta?: LemonSqueezyMetaPayload | null;
};

type LemonSqueezyActivationResponse = {
  activated?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicensePayload | null;
  instance?: LemonSqueezyInstancePayload | null;
  meta?: LemonSqueezyMetaPayload | null;
};

type LemonSqueezyDeactivationResponse = {
  deactivated?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicensePayload | null;
  meta?: LemonSqueezyMetaPayload | null;
};

const resolveLicenseApiKey = () => {
  const apiKey = process.env[API_KEY_ENV]?.trim() ?? "";
  if (!apiKey) {
    throw new Error(`Missing Lemon Squeezy license API key: ${API_KEY_ENV}`);
  }
  return apiKey;
};

const buildHeaders = () => {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Authorization", `Bearer ${resolveLicenseApiKey()}`);
  return headers;
};

const postLicenseApi = async <T>(
  path: "validate" | "activate" | "deactivate",
  body: URLSearchParams
) => {
  const response = await fetch(`${LEMON_SQUEEZY_LICENSE_API_BASE}/${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: body.toString(),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  return { response, payload };
};

export const validateLemonSqueezyLicense = async (
  licenseKey: string,
  instanceId?: string | null
) => {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  if (instanceId?.trim()) {
    body.set("instance_id", instanceId.trim());
  }
  return postLicenseApi<LemonSqueezyValidationResponse>("validate", body);
};

export const activateLemonSqueezyLicense = async (
  licenseKey: string,
  instanceName: string
) => {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  body.set("instance_name", instanceName);
  return postLicenseApi<LemonSqueezyActivationResponse>("activate", body);
};

export const deactivateLemonSqueezyLicense = async (
  licenseKey: string,
  instanceId: string
) => {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  body.set("instance_id", instanceId);
  return postLicenseApi<LemonSqueezyDeactivationResponse>("deactivate", body);
};

export const readLemonSqueezyInstanceId = (
  payload:
    | LemonSqueezyValidationResponse
    | LemonSqueezyActivationResponse
    | LemonSqueezyDeactivationResponse
    | null
    | undefined
) => {
  if (!payload || !("instance" in payload)) return null;
  const instanceId = payload.instance?.id;
  return typeof instanceId === "string" && instanceId.trim() ? instanceId.trim() : null;
};

export const readLemonSqueezyError = (
  payload:
    | LemonSqueezyValidationResponse
    | LemonSqueezyActivationResponse
    | LemonSqueezyDeactivationResponse
    | null
    | undefined
) => {
  const error = payload?.error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
};

export const readLemonSqueezyLicenseValidity = (
  payload: LemonSqueezyValidationResponse | LemonSqueezyActivationResponse | null | undefined
) => {
  if (!payload) return false;
  if ("valid" in payload) return payload.valid === true;
  if ("activated" in payload) return payload.activated === true;
  return false;
};

export const readLemonSqueezyLicenseDetails = (
  payload:
    | LemonSqueezyValidationResponse
    | LemonSqueezyActivationResponse
    | LemonSqueezyDeactivationResponse
    | null
    | undefined
): LemonSqueezyLicenseDetails | null => {
  if (!payload) return null;
  const licenseKey = payload.license_key ?? null;
  const instance =
    "instance" in payload && payload.instance ? payload.instance : null;
  const meta = payload.meta ?? null;
  return {
    status: licenseKey?.status ?? null,
    key: licenseKey?.key ?? null,
    activationLimit:
      typeof (licenseKey as { activation_limit?: unknown } | null)?.activation_limit ===
      "number"
        ? (licenseKey as { activation_limit: number }).activation_limit
        : null,
    activationUsage:
      typeof (licenseKey as { activation_usage?: unknown } | null)?.activation_usage ===
      "number"
        ? (licenseKey as { activation_usage: number }).activation_usage
        : null,
    createdAt: licenseKey?.created_at ?? null,
    expiresAt: licenseKey?.expires_at ?? null,
    instanceId: instance?.id ?? null,
    instanceName: instance?.name ?? null,
    instanceCreatedAt: instance?.created_at ?? null,
    storeId: typeof meta?.store_id === "number" ? meta.store_id : null,
    orderId: typeof meta?.order_id === "number" ? meta.order_id : null,
    orderItemId: typeof meta?.order_item_id === "number" ? meta.order_item_id : null,
    productId: typeof meta?.product_id === "number" ? meta.product_id : null,
    productName: meta?.product_name ?? null,
    variantId: typeof meta?.variant_id === "number" ? meta.variant_id : null,
    variantName: meta?.variant_name ?? null,
    customerId: typeof meta?.customer_id === "number" ? meta.customer_id : null,
    customerName: meta?.customer_name ?? null,
    customerEmail: meta?.customer_email ?? null,
  };
};
