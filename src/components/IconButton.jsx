export default function IconButton({
  label,
  children,
  onClick,
  variant = "quiet",
  className = "",
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      className={`icon-button icon-button--${variant} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
