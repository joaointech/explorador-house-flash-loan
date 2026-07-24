interface LogoProps {
  size?: number;
  className?: string;
  type?: "full" | "icon" | "text";
  variant?: LogoVariant;
}

export type LogoVariant = "twotone" | "white" | "blue";

// Brand mark is an image asset (a white "doorway" pin). Two on-disk versions:
//   - /logo.svg      white mark, for dark / coloured surfaces (navbar, footer)
//   - /logo-blue.svg brand-blue mark, for light surfaces (e.g. the mobile menu)
// The `twotone` and `white` variants both render on dark surfaces, so they use
// the white asset; `blue` is the light-surface variant.
const LOGO_SRC: Record<LogoVariant, string> = {
  twotone: "/logo.svg",
  white: "/logo.svg",
  blue: "/logo-blue.svg",
};

// Wordmark text colour per variant (still a vector — only the mark is an image).
const TEXT_TONE: Record<LogoVariant, string> = {
  twotone: "#F8FAFC",
  white: "#F8FAFC",
  blue: "#2563EB",
};

// "explorador" brand mark — image asset rendered in a square box (object-contain
// keeps the ~square artwork from distorting at any size).
function LogoMark({
  size,
  variant = "blue",
  className = "",
}: {
  size: number;
  variant?: LogoVariant;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no optimisation needed
    <img
      src={LOGO_SRC[variant]}
      alt="explorador"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function WordmarkText({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold lowercase tracking-tight ${className}`}>
      explorador
    </span>
  );
}

export function Logo({
  size = 32,
  className = "",
  type = "full",
  variant = "blue",
}: LogoProps) {
  if (type === "icon") {
    return <LogoMark size={size} variant={variant} className={className} />;
  }

  if (type === "text") {
    return <WordmarkText className={className} />;
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      style={{ color: TEXT_TONE[variant] }}
    >
      <LogoMark size={size} variant={variant} />
      <WordmarkText className="text-xl" />
    </span>
  );
}

export default Logo;
