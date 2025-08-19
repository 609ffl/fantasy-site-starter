// components/NavBar.tsx
import Link from "next/link";
import { useRouter } from "next/router";

function NavItem({ href, label }: { href: string; label: string }) {
  const { pathname } = useRouter();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        textDecoration: "none",
        fontWeight: active ? 700 : 500,
        background: active ? "#eef3ff" : "transparent",
        color: active ? "#1a3fbf" : "#243447",
      }}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "saturate(180%) blur(8px)",
        background: "rgba(255,255,255,0.9)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>
          609 FFL
        </Link>
        <nav style={{ display: "flex", gap: 6 }}>
          <NavItem href="/" label="Scoreboard" />
          <NavItem href="/history" label="History" />
          {/* Add more when ready: <NavItem href="/owners" label="Owners" /> */}
        </nav>
      </div>
    </header>
  );
}
