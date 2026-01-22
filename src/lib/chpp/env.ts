export type ChppEnv = {
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
};

export function getChppEnv(): ChppEnv {
  const consumerKey = process.env.CHPP_CONSUMER_KEY;
  const consumerSecret = process.env.CHPP_CONSUMER_SECRET;
  const callbackUrl = process.env.CHPP_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !callbackUrl) {
    const missing = [
      !consumerKey ? "CHPP_CONSUMER_KEY" : null,
      !consumerSecret ? "CHPP_CONSUMER_SECRET" : null,
      !callbackUrl ? "CHPP_CALLBACK_URL" : null,
    ].filter(Boolean);

    throw new Error(
      `Missing required CHPP env vars: ${missing.join(", ")}`
    );
  }

  return { consumerKey, consumerSecret, callbackUrl };
}
