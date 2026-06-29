import { cn } from "@/lib/utils";

export function Logo({
  className,
  showText = true,
  size = 32,
}: {
  className?: string;
  showText?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="relative flex items-center justify-center rounded-lg bg-gold-gradient glow-gold"
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.62}
          height={size * 0.62}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L3 7v6c0 5.25 3.75 9.74 9 11 5.25-1.26 9-5.75 9-11V7l-9-5z"
            stroke="#0a0a0b"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M9 12.5l2.2 2.2L15.5 10"
            stroke="#0a0a0b"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-metric text-sm font-bold tracking-[0.18em] text-foreground">
            NIGHTMARE
          </span>
          <span className="font-metric text-[10px] font-medium tracking-[0.32em] text-gold">
            INVEST
          </span>
        </div>
      )}
    </div>
  );
}
