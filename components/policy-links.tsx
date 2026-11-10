import Link from "next/link";

// Keep the in-memory conversation open when reading a policy from the chat.
export function PolicyLinks({ newTab = false }: { newTab?: boolean }) {
  return <nav className="policy-links" aria-label="Privacy and terms">
    <Link href="/privacy" target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>Privacy Policy</Link>
    <span aria-hidden="true">·</span>
    <Link href="/terms" target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>Terms of Service</Link>
  </nav>;
}
