export function isAdminModeEnabled() {
  return process.env.ADMIN_MODE === "true";
}
