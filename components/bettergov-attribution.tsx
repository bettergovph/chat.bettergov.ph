import Image from "next/image";

export function BetterGovAttribution() {
  return <a className="bettergov-attribution" href="https://bettergov.ph/" target="_blank" rel="noopener noreferrer" aria-label="An initiative by BetterGov.ph (opens in a new tab)">
    <small>An initiative by</small>
    <Image src="/brand/bettergov-horizontal-primary.png" alt="BetterGov.ph" width={176} height={44} unoptimized />
  </a>;
}
