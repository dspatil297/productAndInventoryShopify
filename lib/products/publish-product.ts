import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { PUBLISHABLE_PUBLISH_MUTATION } from "@/lib/shopify/mutations";
import { PUBLICATIONS_QUERY } from "@/lib/shopify/queries";

interface PublicationsResponse {
  publications: {
    nodes: Array<{
      id: string;
      catalog: { title: string } | null;
    }>;
  };
}

interface PublishResponse {
  publishablePublish: {
    publishable: { id: string; title: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/** Publish product to all sales channels (needed for Online Store visibility). */
export async function publishShopProduct(
  shop: Shop,
  productId: string,
): Promise<{ published: number; errors: string[] }> {
  const pubs = await shopifyGraphqlForShop<PublicationsResponse>(
    shop,
    PUBLICATIONS_QUERY,
    { first: 25 },
  );

  const publicationIds = pubs.publications.nodes.map((node) => node.id);
  if (publicationIds.length === 0) {
    return {
      published: 0,
      errors: ["No sales channels/publications found to publish to"],
    };
  }

  const data = await shopifyGraphqlForShop<PublishResponse>(
    shop,
    PUBLISHABLE_PUBLISH_MUTATION,
    {
      id: productId,
      input: publicationIds.map((publicationId) => ({ publicationId })),
    },
  );

  const errors = data.publishablePublish.userErrors.map((error) => error.message);
  if (errors.length > 0) {
    return { published: 0, errors };
  }

  return { published: publicationIds.length, errors: [] };
}
