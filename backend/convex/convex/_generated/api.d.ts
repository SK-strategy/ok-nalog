/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as drafts from "../drafts.js";
import type * as executors from "../executors.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as jwks from "../jwks.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_orders from "../lib/orders.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_sentry from "../lib/sentry.js";
import type * as merge from "../merge.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as tags from "../tags.js";
import type * as telemetry from "../telemetry.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  categories: typeof categories;
  crons: typeof crons;
  drafts: typeof drafts;
  executors: typeof executors;
  files: typeof files;
  http: typeof http;
  jwks: typeof jwks;
  "lib/auth": typeof lib_auth;
  "lib/email": typeof lib_email;
  "lib/ledger": typeof lib_ledger;
  "lib/notifications": typeof lib_notifications;
  "lib/orders": typeof lib_orders;
  "lib/payments": typeof lib_payments;
  "lib/sentry": typeof lib_sentry;
  merge: typeof merge;
  messages: typeof messages;
  notifications: typeof notifications;
  orders: typeof orders;
  payments: typeof payments;
  seed: typeof seed;
  seedData: typeof seedData;
  tags: typeof tags;
  telemetry: typeof telemetry;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
