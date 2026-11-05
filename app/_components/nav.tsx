"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const homeActive = pathname === "/";
  const libraryActive = pathname.startsWith("/games");
  const hallActive = pathname.startsWith("/hall-of-fame");
  const aboutActive = pathname.startsWith("/about");
  const loginActive = pathname.startsWith("/login");

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={homeActive ? "active" : ""}>
            Home
          </Link>
          <Link href="/games" className={libraryActive ? "active" : ""}>
            Library
          </Link>
          <Link href="/hall-of-fame" className={hallActive ? "active" : ""}>
            Hall of Fame
          </Link>
          <Link href="/about" className={aboutActive ? "active" : ""}>
            About
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CREDITS · 03</span>
        </div>
        {user ? (
          <button type="button" className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Sign In
          </Link>
        )}
        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menu"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENU</div>
        <Link href="/" className={homeActive ? "active" : ""} onClick={close}>
          Home
        </Link>
        <Link
          href="/games"
          className={libraryActive ? "active" : ""}
          onClick={close}
        >
          Library
        </Link>
        <Link
          href="/hall-of-fame"
          className={hallActive ? "active" : ""}
          onClick={close}
        >
          Hall of Fame
        </Link>
        <Link
          href="/about"
          className={aboutActive ? "active" : ""}
          onClick={close}
        >
          About
        </Link>
        {!user && (
          <Link
            href="/login"
            className={loginActive ? "active" : ""}
            onClick={close}
          >
            Sign In
          </Link>
        )}
        <div className="flex-1"></div>
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">
          CREDITS · 03
        </div>
      </aside>
    </>
  );
}
