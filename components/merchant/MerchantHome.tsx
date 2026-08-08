"use client";

import { BlockStack, Card, InlineGrid, Page, Text } from "@shopify/polaris";
import type { AgencyStoreSummary } from "@/lib/agency/stores";
import { MerchantPortalLaunch } from "@/components/merchant/MerchantPortalLaunch";

interface MerchantHomeProps {
  store: AgencyStoreSummary;
  handoffToken: string;
}

export function MerchantHome({ store, handoffToken }: MerchantHomeProps) {
  return (
    <Page title={store.shopName} subtitle={store.shopDomain}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Connected store overview. Open the full dashboard to manage
              products, metafields, and inventory outside the Admin iframe. If
              you already signed in for this store, you land on tools; otherwise
              you create or use a dashboard login.
            </Text>
            <MerchantPortalLaunch handoffToken={handoffToken} />
          </BlockStack>
        </Card>
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard label="Currency" value={store.currencyCode} />
          <StatCard label="Plan" value={store.planName ?? "—"} />
          <StatCard
            label="Products"
            value={String(store.productCount ?? "—")}
          />
          <StatCard label="Locations" value={String(store.locationCount)} />
          <StatCard
            label="Metafield defs"
            value={String(store.metafieldDefCount)}
          />
          <StatCard
            label="Last sync"
            value={
              store.lastSyncedAt
                ? new Date(store.lastSyncedAt).toLocaleString()
                : "—"
            }
          />
          <StatCard label="Timezone" value={store.timezone} />
          <StatCard
            label="Low stock threshold"
            value={String(store.lowStockThreshold)}
          />
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingMd">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}
