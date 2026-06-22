import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FtwRoomClient } from "./room-client";

export const dynamic = "force-dynamic";

export default async function FtwRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/");

  const { code } = await params;
  const upper = code.toUpperCase();
  const room = await prisma.ftwRoom.findUnique({
    where: { code: upper },
    include: {
      players: { where: { leftAt: null }, select: { userId: true } },
    },
  });
  if (!room) notFound();

  const isMember =
    room.hostId === session.user.id ||
    room.players.some((p) => p.userId === session.user.id);

  return (
    <main className="ftw-shell">
      <div className="ftw-page">
        <FtwRoomClient
          code={room.code}
          isMember={isMember}
          isHost={room.hostId === session.user.id}
          userId={session.user.id}
        />
      </div>
    </main>
  );
}
