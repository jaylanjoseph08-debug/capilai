"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, PackagePlus, CircleUserRound } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import type { TranslationKey } from "@/lib/i18n";

const items: { href: string; labelKey: TranslationKey; icon: typeof LayoutGrid }[] = [
  { href: "/dashboard", labelKey: "nav.profile", icon: LayoutGrid },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/placard", labelKey: "nav.closet", icon: PackagePlus },
  { href: "/settings", labelKey: "nav.account", icon: CircleUserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2.5">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-2 py-1">
              <Icon size={19} className={active ? "text-copper-light" : "text-muted"} strokeWidth={active ? 2.3 : 2} />
              <span
                className={`font-mono text-[9px] uppercase tracking-wide ${
                  active ? "text-copper-light" : "text-muted"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
