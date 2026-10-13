"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LogoLoader } from "@/shared/components/LogoLoader";

/** A link that covers the page with the spinning logo until the next page takes over. */
export function LoadingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(event) => {
          // Let modified clicks (new tab, etc.) behave normally.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          setLoading(true);
        }}
      >
        {children}
      </Link>
      {loading && <LogoLoader label="Loading" />}
    </>
  );
}
