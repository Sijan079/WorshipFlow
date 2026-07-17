import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      <Image
        src="/logo-transparent.png"
        alt="WorshipFlow"
        width={1408}
        height={768}
        priority
        unoptimized
        className="absolute left-0 top-1/2 h-auto w-full -translate-y-1/2 brightness-0 invert"
      />
    </span>
  );
}
