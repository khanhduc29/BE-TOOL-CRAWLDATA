"use client";

import Link from "next/link";
import { useState } from "react";
import MegaMenu from "./MegaMenu";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="header-logo">
            🛠 CrawlerTool
          </Link>

          <nav className="header-nav">
            <button
              className="nav-tools-btn"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ⬡ Tools
            </button>
            <Link href="/">Trang chủ</Link>
            <Link href="/settings/accounts">Cài đặt</Link>
          </nav>
        </div>
      </header>

      {menuOpen && <MegaMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
