/** Shared temporary password for go-live / invite / bulk create */
export const DEFAULT_TEMP_PASSWORD = "ChangeMe123!";

export function isTempPassword(value: string): boolean {
  return value === DEFAULT_TEMP_PASSWORD;
}
