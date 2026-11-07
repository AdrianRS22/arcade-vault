import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
  compact?: boolean; // inside a bordered panel that already frames it
};

/** Empty state for score boards: says what is missing and what to do. */
export function EmptyBoard({ title, children, action, compact }: Props) {
  return (
    <div className={"empty-board" + (compact ? " compact" : "")}>
      <div className="eb-title">{title}</div>
      <p className="eb-text">{children}</p>
      {action && (
        <Link href={action.href} className="btn eb-action">
          {action.label}
        </Link>
      )}
    </div>
  );
}
