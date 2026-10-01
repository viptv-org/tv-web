/** Catalog avatar image, shared by the React and SolidTV profile surfaces. */
export const avatarSrc = (style: string, choice: number) =>
  `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`;
