import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useMemo } from "react";

const links = [
  { href: "/", label: "Scoreboard" },
  { href: "/history", label: "History" },
  { href: "/owners", label: "Owners" },
  { href: "/players", label: "Players" },
  // NEW
  { href: "/standings", label: "Standings" },
];

export default function NavBar() {
  const { pathname } = useRouter();
  const [open, setOpen] = useState(false);

  // treat a link as active if pathname is exactly it or starts with it (for subpages)
  const isActive = useMemo(
    () => (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/609ffl-logo.png" alt="609 FFL" width={40} height={40} />
          <span className="text-lg font-semibold tracking-tight">609 FFL</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-4 md:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-3 py-2 text-sm font-medium transition
                  ${active
                    ? "bg-green-100 text-green-700"
                    : "text-slate-700 hover:bg-slate-100"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden rounded p-2 ring-1 ring-slate-200"
          aria-label="Toggle menu"
        >
          <div className="mb-1.5 h-0.5 w-5 bg-slate-800" />
          <div className="mb-1.5 h-0.5 w-5 bg-slate-800" />
          <div className="h-0.5 w-5 bg-slate-800" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col p-2">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded px-3 py-3 text-base transition
                    ${active
                      ? "bg-green-100 text-green-700"
                      : "hover:bg-slate-100"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
