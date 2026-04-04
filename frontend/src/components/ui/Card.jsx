/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function Card({ className = "", children, ...rest }) {
  return (
    <div
      className={[
        "rounded-card border border-border bg-elevated p-6 shadow-card",
        "transition-colors duration-200 ease-out hover:border-border/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
