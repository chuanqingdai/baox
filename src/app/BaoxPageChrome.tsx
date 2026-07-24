import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";

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
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-16 md:py-0">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="保罗万相首页">
            <img
              src="/insurance/baox-original/BOAX-LOGO-W.png"
              alt="BAOX.AI"
              className="h-6 w-auto max-w-[128px] object-contain sm:h-7 sm:max-w-[150px]"
            />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  active === item.href ? "bg-white text-black" : "text-white/54 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <details className="baox-mobile-menu relative md:hidden">
            <summary className="inline-flex h-10 w-10 list-none items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/10">
              <Menu size={20} />
            </summary>
            <nav className="absolute right-0 top-12 z-50 w-56 rounded-[1.4rem] border border-white/10 bg-[#090909]/96 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition ${
                    active === item.href ? "bg-white text-black" : "text-white/62 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
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
