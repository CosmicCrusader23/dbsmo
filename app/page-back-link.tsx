import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PageBackLinkProps = {
  destination: string;
  href: string;
  className?: string;
};

export function PageBackLink({ destination, href, className = "" }: PageBackLinkProps) {
  const label = `Back to ${destination}`;
  const classes = ["secondary-action", "page-back-link", className].filter(Boolean).join(" ");

  return (
    <Link aria-label={label} className={classes} data-page-back="true" href={href}>
      <ArrowLeft aria-hidden="true" size={18} />
      <span>{label}</span>
    </Link>
  );
}
