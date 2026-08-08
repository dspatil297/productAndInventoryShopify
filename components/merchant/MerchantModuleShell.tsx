"use client";

import { BlockStack, Card, Page, Text } from "@shopify/polaris";

interface MerchantModuleShellProps {
  title: string;
  shopName: string;
  description: string;
}

export function MerchantModuleShell({
  title,
  shopName,
  description,
}: MerchantModuleShellProps) {
  return (
    <Page title={title} subtitle={shopName}>
      <Card>
        <BlockStack gap="200">
          <Text as="p" tone="subdued">
            {description}
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
