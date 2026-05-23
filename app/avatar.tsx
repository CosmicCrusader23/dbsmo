import type { CSSProperties } from "react";
import { pickInitial, avatarTint } from "@/lib/avatar";

type AvatarUser = {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
};

type AvatarSize = "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = { sm: 28, md: 40, lg: 56 };

export function Avatar({
  user,
  size = "md",
  className,
}: {
  user: AvatarUser;
  size?: AvatarSize;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const url = user.avatarUrl ?? user.image ?? null;
  const initial = pickInitial(user);
  const seed = (user.id ?? user.email ?? user.displayName ?? user.name ?? "?").toString();
  const tint = avatarTint(seed);

  if (url) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={url}
        alt=""
        className={`avatar avatar-${size}${className ? " " + className : ""}`}
        style={{ width: px, height: px }}
      />
    );
  }

  const style: CSSProperties = {
    width: px,
    height: px,
    background: tint.bg,
    color: tint.fg,
    fontSize: Math.round(px * 0.42),
  };

  return (
    <span
      className={`avatar avatar-${size} avatar-fallback${className ? " " + className : ""}`}
      style={style}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
