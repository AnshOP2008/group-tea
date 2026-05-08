import { createServerFn } from "@tanstack/react-start";

// Returns the server's current time (NTP-synced on the host).
// We use this instead of Date.now() on the client to prevent
// users with manipulated/skewed device clocks from unlocking results early.
export const getServerNow = createServerFn({ method: "GET" }).handler(async () => {
  return { now: Date.now() };
});
