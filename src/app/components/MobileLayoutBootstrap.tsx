import { MOBILE_LAYOUT_BOOTSTRAP_SCRIPT } from "@/lib/mobileLayoutBootstrap";

export default function MobileLayoutBootstrap() {
  return (
    <script
      id="ya-mobile-layout-bootstrap"
      dangerouslySetInnerHTML={{ __html: MOBILE_LAYOUT_BOOTSTRAP_SCRIPT }}
    />
  );
}
