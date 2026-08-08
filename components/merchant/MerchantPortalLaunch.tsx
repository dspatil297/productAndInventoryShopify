"use client";

import { Button } from "@shopify/polaris";

interface MerchantPortalLaunchProps {
  handoffToken: string;
}

export function MerchantPortalLaunch({ handoffToken }: MerchantPortalLaunchProps) {
  return (
    <form method="GET" action="/merchant/enter" target="_blank">
      <input type="hidden" name="handoff" value={handoffToken} />
      <Button variant="primary" submit>
        Manage products &amp; inventory
      </Button>
    </form>
  );
}
