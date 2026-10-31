"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Equalizer } from "@/components/equalizer";

const IMAGES = [
  {
    src: "/app-1.webp",
    alt: "Revive ST listing the SoundTouch speakers found on the network",
  },
  {
    src: "/app-2.webp",
    alt: "Revive ST now playing screen with playback and volume controls",
  },
  {
    src: "/app-3.webp",
    alt: "Revive ST internet radio browser with trending stations",
  },
  {
    src: "/app-4.webp",
    alt: "Revive ST speaker settings with sound and preset options",
  },
];

export function HeroPhone() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
    }, 3500);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative isolate mx-auto w-full max-w-[260px] sm:max-w-[300px] aspect-[19.5/40]">
      {/* Glow and sound-wave rings radiating from the phone, after the logo's waves */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170%] aspect-square -z-20 rounded-full bg-accent-muted blur-3xl" />
      {[150, 220, 290].map((size) => (
        <div
          key={size}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-square rounded-full border border-separator -z-10"
          style={{ width: `${size}%` }}
        />
      ))}
      {[0, 2].map((delay) => (
        <div
          key={delay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220%] aspect-square rounded-full border border-accent/40 -z-10 opacity-0 motion-safe:animate-ring"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}

      {/* Phone Hardware Mockup */}
      <div className="absolute inset-0 rounded-[3rem] border-[12px] border-device-frame bg-device-frame shadow-phone overflow-hidden ring-1 ring-separator">
        <div className="absolute inset-0 rounded-[2.25rem] border-[4px] border-device-bezel bg-device-bezel overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-6 bg-device-bezel z-50 rounded-b-3xl mx-[20%] flex justify-center items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-device-camera border border-device-frame/50" />
          </div>

          <div className="relative w-full h-full bg-device-bezel rounded-[2rem] overflow-hidden">
            {IMAGES.map((image, index) => (
              <div
                key={image.src}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="300px"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating status cards */}
      <div
        aria-hidden
        className="absolute top-[14%] -left-[38%] hidden sm:flex items-center gap-3 rounded-2xl bg-surface-1/85 backdrop-blur-xl ring-1 ring-separator shadow-phone px-3.5 py-3 motion-safe:animate-float"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent font-bold font-mono">
          3
        </div>
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-wider text-fg-tertiary">
            Preset button
          </p>
          <p className="text-sm font-semibold text-fg">Radio Paradise</p>
        </div>
        <Equalizer bars={4} className="h-5 w-5 ml-1" />
      </div>
      <div
        aria-hidden
        className="absolute bottom-[16%] -right-[34%] hidden sm:flex items-center gap-3 rounded-2xl bg-surface-1/85 backdrop-blur-xl ring-1 ring-separator shadow-phone px-3.5 py-3 motion-safe:animate-float [animation-delay:-3s]"
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-accent-muted text-accent">
          <Check className="size-4" strokeWidth={3} />
        </div>
        <div className="text-left">
          <p className="text-[11px] uppercase tracking-wider text-fg-tertiary">
            Living room
          </p>
          <p className="text-sm font-semibold text-fg">SoundTouch 20 found</p>
        </div>
      </div>
    </div>
  );
}
