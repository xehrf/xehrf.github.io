import { Link } from "react-router-dom";

export const variants = {
  primary:
    "bg-accent text-black font-semibold shadow-glow hover:bg-accent-hover hover:shadow-[0_0_28px_rgba(255,215,0,0.35)] active:scale-[0.99]",
  secondary:
    "font-medium bg-elevated text-foreground border border-border hover:border-accent/50 hover:text-accent",
  ghost: "font-medium text-muted hover:text-accent hover:bg-white/5",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-btn px-5 py-2.5 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'} [props.variant]
 * @param {string} [props.className]
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} props.children
 */
export function Button({
  variant = "primary",
  className = "",
  disabled,
  children,
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        baseClasses,
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant] ?? variants.primary,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * @param {object} props
 * @param {string} props.to
 * @param {'primary'|'secondary'|'ghost'} [props.variant]
 */
export function LinkButton({ to, variant = "primary", className = "", children, ...rest }) {
  return (
    <Link
      to={to}
      className={[baseClasses, variants[variant] ?? variants.primary, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </Link>
  );
}
