import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/masterclass", label: "保险大师课" },
  { href: "/poster", label: "保险海报" },
  { href: "/tool", label: "工具包" },
  { href: "/lab", label: "作品集" },
  { href: "/about", label: "关于我们" },
] as const;

type BaoxPageChromeProps = {
  active: string;
  children: ReactNode;
};

export function BaoxPageChrome({ active, children }: BaoxPageChromeProps) {
  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/78 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-16 md:flex-nowrap md:py-0">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="保罗万相首页">
            <img
              src="/insurance/baox-original/BOAX-LOGO-W.png"
              alt="BAOX.AI"
              className="h-6 w-auto max-w-[128px] object-contain sm:h-7 sm:max-w-[150px]"
            />
          </Link>
          <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 pb-1 md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0 md:pb-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  active === item.href ? "bg-white text-black" : "text-white/54 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://baox.ai/index.html"
            className="inline-flex h-9 items-center justify-center rounded-full bg-amber-400 px-4 text-xs font-black text-black shadow-[0_16px_36px_rgba(245,158,11,0.28)] transition hover:bg-amber-300 sm:h-10 sm:px-5 sm:text-sm"
          >
            开始出图
          </Link>
        </div>
      </header>

      {children}

      <footer className="border-t border-white/10 px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 text-sm text-white/48 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <img
              src="/insurance/baox-original/BOAX-LOGO-W.png"
              alt="BAOX.AI"
              className="h-7 w-auto max-w-[150px] object-contain"
            />
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link href="/masterclass" className="transition hover:text-amber-300">保险大师课</Link>
            <Link href="/poster" className="transition hover:text-amber-300">保险海报</Link>
            <Link href="/tool" className="transition hover:text-amber-300">工具包</Link>
            <Link href="/lab" className="transition hover:text-amber-300">作品集</Link>
            <Link href="/about" className="transition hover:text-amber-300">关于我们</Link>
          </div>
          <span>© 2026 保罗万相</span>
        </div>
      </footer>
    </main>
  );
}
