import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * The supported models, from the drawings in packages/design/speakers (copied
 * to public/speakers by `vp run design#icons`). Sizes are the drawings'
 * viewBoxes, 10 units per inch, so the models keep their relative sizes.
 */
const MODELS = [
  { model: "10", file: "soundtouch-10", width: 56, height: 88 },
  { model: "20", file: "soundtouch-20", width: 124, height: 78 },
  { model: "30", file: "soundtouch-30", width: 171, height: 102 },
  { model: "Portable", file: "soundtouch-portable", width: 96, height: 66 },
];

const TALLEST = Math.max(...MODELS.map((model) => model.height));

export function SupportedSpeakers() {
  return (
    <section className="px-4">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6 rounded-3xl bg-surface-1 px-6 py-5 md:flex-row md:gap-10">
        <div className="shrink-0 text-center md:text-left">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Check className="size-4 text-accent" strokeWidth={3} />
            Works with every SoundTouch speaker
          </h2>
          <Link
            href="/docs/supported-speakers"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            See compatibility
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <ul className="grid w-full flex-1 grid-cols-4 gap-3 md:gap-6">
          {MODELS.map(({ model, file, width, height }) => (
            <li key={model} className="flex flex-col items-center">
              {/* Every model stands on the same floor, at the same scale */}
              <div className="flex h-12 w-full items-end justify-center sm:h-16">
                <Image
                  src={`/speakers/${file}.svg`}
                  alt=""
                  width={width}
                  height={height}
                  style={{ height: `${(height / TALLEST) * 100}%` }}
                  className="w-auto max-w-full object-contain object-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]"
                />
              </div>
              <p className="mt-2 whitespace-nowrap text-center text-xs font-medium text-fg-secondary">
                <span className="hidden sm:inline">SoundTouch </span>
                <span className="sm:hidden">ST </span>
                {model}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
