import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PageBackLinkProps = {
  destination: string;
  href: string;
  compact?: boolean;
  className?: string;
};

export function PageBackLink({
  destination,
  href,
  compact = false,
  className = "",
}: PageBackLinkProps) {
  const label = `Back to ${destination}`;
  const classes = ["secondary-action", "page-back-link", compact ? "compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link aria-label={label} className={classes} data-page-back="true" href={href}>
      <ArrowLeft aria-hidden="true" size={compact ? 16 : 18} />
      <span>{label}</span>
    </Link>
  );
}
