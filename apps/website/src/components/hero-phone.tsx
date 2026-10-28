"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const IMAGES = ["/app-1.png", "/app-2.png", "/app-3.png", "/app-4.png"];

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
    <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[320px] aspect-[19.5/40]">
      {/* Decorative concentric circles behind the phone */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square border border-separator rounded-full -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220%] aspect-square border border-separator rounded-full -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[290%] aspect-square border border-separator rounded-full -z-10" />

      {/* Phone Hardware Mockup */}
      <div className="absolute inset-0 rounded-[3rem] border-[12px] border-device-frame bg-device-frame shadow-phone overflow-hidden ring-1 ring-separator">
        {/* Inner bezel */}
        <div className="absolute inset-0 rounded-[2.25rem] border-[4px] border-device-bezel bg-device-bezel overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 inset-x-0 h-6 bg-device-bezel z-50 rounded-b-3xl mx-[20%] flex justify-center items-center">
            {/* Camera dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-device-camera border border-device-frame/50" />
          </div>

          {/* Screen Content */}
          <div className="relative w-full h-full bg-device-bezel rounded-[2rem] overflow-hidden">
            {IMAGES.map((src, index) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={src}
                  alt={`App screenshot ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 300px, 400px"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
