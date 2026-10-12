declare const USAGEATLAS_CLOUD_URL: string;

/** The usageatlas.com origin, or a local one for development builds. */
export const CLOUD_URL =
  typeof USAGEATLAS_CLOUD_URL === "string"
    ? USAGEATLAS_CLOUD_URL
    : "https://usageatlas.com";
