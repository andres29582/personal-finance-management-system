export function getVisibleResetToken(
  isDevelopmentBuild: boolean,
  resetToken?: string | null,
): string {
  return isDevelopmentBuild && resetToken ? resetToken : '';
}
