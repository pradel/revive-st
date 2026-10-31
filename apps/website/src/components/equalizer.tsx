import { cn } from "@/lib/cn";

/**
 * Bouncing level bars. Durations, delays and resting heights derive from the
 * bar index so server and client render the same markup; with reduced motion
 * the bars stay at their resting heights.
 */
export function Equalizer({
  bars = 5,
  className = "",
  barClassName = "bg-accent",
}: {
  bars?: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div aria-hidden className={cn("flex items-end gap-[3px]", className)}>
      {Array.from({ length: bars }, (_bar, index) => (
        <span
          key={index}
          className={cn(
            "h-full flex-1 origin-bottom rounded-full motion-safe:animate-eq",
            barClassName,
          )}
          style={{
            transform: `scaleY(${0.3 + ((index * 29) % 7) / 10})`,
            animationDuration: `${0.55 + ((index * 37) % 9) / 20}s`,
            animationDelay: `-${((index * 53) % 10) / 10}s`,
          }}
        />
      ))}
    </div>
  );
}
