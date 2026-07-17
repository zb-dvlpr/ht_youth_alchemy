export type YouTubeIconVariant = "default" | "tight";

type YouTubeIconProps = {
  className?: string;
  variant?: YouTubeIconVariant;
};

export default function YouTubeIcon({
  className,
  variant = "default",
}: YouTubeIconProps) {
  const viewBox = variant === "tight" ? "2 5 20 14" : "0 0 24 24";

  return (
    <svg
      className={className}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0000" />
      <path d="M10 9L16 12L10 15V9Z" fill="#ffffff" />
    </svg>
  );
}
