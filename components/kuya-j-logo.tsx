import Image from "next/image";

// Transparent mascot, edited from the user's original artwork. No embedded wordmark.
export function KuyaJLogo({ avatar = false, className = "", decorative = false }: { avatar?: boolean; className?: string; decorative?: boolean }) {
  return <span className={`${avatar ? "kuya-avatar" : "kuya-logo"} ${className}`} aria-hidden={decorative || undefined}>
    <Image src="/brand/kuya-j-mascot.webp" alt={decorative ? "" : "Kuya J mascot"} width={512} height={512} sizes={avatar ? "40px" : "(max-width: 767px) 88px, 104px"} unoptimized />
  </span>;
}
