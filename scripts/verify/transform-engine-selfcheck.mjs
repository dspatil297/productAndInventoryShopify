import assert from "node:assert/strict";

export async function runTransformEngineSelfCheck() {
  const saleFromList = (listPrice) => {
    const sale = Math.ceil(listPrice * 0.95);
    return { price: String(sale), compare_at: String(Math.ceil(listPrice)) };
  };
  const prices = saleFromList(10000);
  assert.equal(prices.price, "9500");
  assert.equal(prices.compare_at, "10000");

  const slugify = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  assert.equal(slugify("Ethnic Wear"), "ethnic-wear");
}
