export const SHOP_QUERY = `
  query ShopBootstrap {
    shop {
      id
      name
      email
      myshopifyDomain
      currencyCode
      timezoneAbbreviation
      plan {
        publicDisplayName
      }
      primaryDomain {
        url
      }
    }
  }
`;

export const METAFIELD_DEFINITIONS_QUERY = `
  query MetafieldDefinitions($first: Int!, $after: String) {
    metafieldDefinitions(first: $first, after: $after, ownerType: PRODUCT) {
      edges {
        node {
          id
          name
          namespace
          key
          type {
            name
          }
          description
          validations {
            name
            value
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const LOCATIONS_QUERY = `
  query Locations($first: Int!) {
    locations(first: $first) {
      nodes {
        id
        name
        isActive
        address {
          city
          country
        }
      }
    }
  }
`;

export const PRODUCTS_COUNT_QUERY = `
  query ProductsCount {
    productsCount {
      count
    }
  }
`;

export const PRODUCT_TYPES_QUERY = `
  query ProductTypes($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          productType
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCTS_LIST_QUERY = `
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          handle
          productType
          status
          variants(first: 10) {
            nodes {
              id
              sku
              price
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByIdentifier($handle: String!, $metafieldFirst: Int!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      title
      handle
      descriptionHtml
      templateSuffix
      variants(first: 1) {
        nodes {
          id
          sku
          price
          compareAtPrice
        }
      }
      metafields(first: $metafieldFirst) {
        nodes {
          namespace
          key
          type
          value
          jsonValue
        }
      }
    }
  }
`;

export const PRODUCT_EDIT_QUERY = `
  query ProductEdit($id: ID!, $metafieldFirst: Int!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      productType
      vendor
      status
      onlineStoreUrl
      onlineStorePreviewUrl
      templateSuffix
      variants(first: 1) {
        nodes {
          id
          sku
          price
          compareAtPrice
          inventoryPolicy
        }
      }
      metafields(first: $metafieldFirst) {
        nodes {
          id
          namespace
          key
          value
          type
          jsonValue
        }
      }
    }
  }
`;

export const PRODUCTS_METAFIELDS_QUERY = `
  query ProductsMetafields(
    $first: Int!
    $after: String
    $query: String
    $metafieldFirst: Int!
  ) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          handle
          metafields(first: $metafieldFirst) {
            nodes {
              id
              namespace
              key
              value
              type
              jsonValue
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const INVENTORY_AT_LOCATION_QUERY = `
  query InventoryAtLocation(
    $first: Int!
    $after: String
    $query: String
    $locationId: ID!
    $names: [String!]!
  ) {
    productVariants(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          title
          sku
          displayName
          product {
            id
            title
            handle
            productType
          }
          inventoryItem {
            id
            tracked
            inventoryLevel(locationId: $locationId) {
              id
              quantities(names: $names) {
                name
                quantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const INVENTORY_ITEM_STATE_QUERY = `
  query InventoryItemState($id: ID!, $locationId: ID!) {
    inventoryItem(id: $id) {
      id
      tracked
      inventoryLevel(locationId: $locationId) {
        id
      }
    }
  }
`;

export const PUBLICATIONS_QUERY = `
  query Publications($first: Int!) {
    publications(first: $first) {
      nodes {
        id
        catalog {
          title
        }
      }
    }
  }
`;
