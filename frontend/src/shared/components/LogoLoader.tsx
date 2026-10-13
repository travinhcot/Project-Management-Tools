/**
 * Full-screen loading curtain; the logo plays the same spin-in as the landing page intro.
 * `once` fades the curtain away afterwards (page-load intro); otherwise it stays until unmounted.
 */
export function LogoLoader({ once = false, label = "Loading" }: { once?: boolean; label?: string }) {
  return (
    <div
      role={once ? undefined : "status"}
      aria-hidden={once ? true : undefined}
      aria-label={once ? undefined : label}
      className={`${once ? "nct-splash" : ""} ${once ? "pointer-events-none" : ""} fixed inset-0 z-50 flex items-center justify-center bg-[#171624]`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/logo.png"
        alt=""
        className={`nct-splash-logo h-24 w-24 object-contain`}
      />
    </div>
  );
}
