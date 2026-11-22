import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers Builds runs `npm run build`, which is
 * `opennextjs-cloudflare build`. OpenNext then compiles the Next.js app by
 * running `npm run build` again unless this points at the plain Next script.
 * Leaving it unset makes the two commands call each other until the builder
 * is killed (exit 137).
 */
const cloudflare = defineCloudflareConfig({});

export default {
  ...cloudflare,
  buildCommand: "npm run build:next",
};
