import ChatApp from "@/components/chat-app";
import { applicationStructuredData, pageMetadata, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site-metadata";

export const metadata = pageMetadata("/", SITE_TITLE, SITE_DESCRIPTION);

export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(applicationStructuredData).replace(/</g, "\\u003c") }} />
    <ChatApp />
  </>;
}
