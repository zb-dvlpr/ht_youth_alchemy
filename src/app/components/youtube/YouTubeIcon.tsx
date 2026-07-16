type YouTubeIconProps = {
  className?: string;
};

export default function YouTubeIcon({ className }: YouTubeIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0000" />
      <path d="M10 9L16 12L10 15V9Z" fill="#ffffff" />
    </svg>
  );
}
