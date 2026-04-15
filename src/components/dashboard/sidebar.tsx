"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { LogOut, Menu } from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface SidebarProps {
  role: "coach" | "client";
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  };
  links: NavLink[];
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function NavLinks({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "text-muted-foreground hover:bg-accent hover:text-white"
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection({
  profile,
  onSignOut,
}: {
  profile: SidebarProps["profile"];
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? "User"} />
        <AvatarFallback className="bg-secondary text-xs text-white">
          {getInitials(profile.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 truncate">
        <p className="truncate text-sm font-medium text-white">
          {profile.full_name ?? "User"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-white"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function Sidebar({ role, profile, links }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
          <div className="px-3">
            <h1 className="text-lg font-bold tracking-tight text-white">
              Protocols By James
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{role} Portal</p>
          </div>

          <NavLinks links={links} pathname={pathname} />
        </div>

        <div className="px-4 pb-6">
          <UserSection profile={profile} onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar p-0 border-none">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
              <div className="px-3">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Protocols By James
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">{role} Portal</p>
              </div>

              <NavLinks links={links} pathname={pathname} />
            </div>

            <div className="mt-auto px-4 pb-6">
              <UserSection profile={profile} onSignOut={handleSignOut} />
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-sm font-semibold text-foreground">Protocols By James</h1>
      </div>
    </>
  );
}
