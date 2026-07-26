"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

type StudentTableRowProps = {
  children: ReactNode;
  href: string;
};

export function StudentTableRow({ children, href }: StudentTableRowProps) {
  const router = useRouter();

  function openStudent(event: MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) {
      return;
    }
    router.push(href);
  }

  return (
    <tr className="student-table-row" onClick={openStudent}>
      {children}
    </tr>
  );
}
