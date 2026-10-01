/** Joins the truthy class names: `join("vx-toast", error && "vx-toast--error")`. */
export const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
