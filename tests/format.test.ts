import { describe, expect, it } from "vitest";
import { formatInr, normalizeIndianMobile, whatsAppLink } from "../src/lib/format";
import { parseCsv, rowsToObjects, toCsv } from "../src/lib/csv";
import { renderTemplate } from "../src/lib/templates";
import { featuresFor } from "../src/lib/plans";

describe("India formatting", () => {
  it("groups rupees in lakhs", () => {
    const formatted = formatInr(1234567.5);
    expect(formatted.replace(/\s/g, " ")).toContain("12,34,567.50");
    expect(formatted).toContain("₹");
  });

  it("accepts Indian mobiles and builds a wa.me link", () => {
    expect(normalizeIndianMobile("+91 98400 12345")).toBe("9840012345");
    expect(normalizeIndianMobile("09840012345")).toBe("9840012345");
    expect(normalizeIndianMobile("5840012345")).toBeNull();
    expect(whatsAppLink("9840012345", "GSTR-3B is due")).toBe(
      "https://wa.me/919840012345?text=GSTR-3B%20is%20due",
    );
  });
});

describe("templates and csv", () => {
  it("fills message variables and leaves unknown tokens empty", () => {
    expect(renderTemplate("Hello {{name}}, invoice {{invoice_number}} for {{amount}}.", {
      name: "Murugan Textiles",
      invoice_number: "KA/26-27/001",
      amount: "₹11,800.00",
    })).toBe("Hello Murugan Textiles, invoice KA/26-27/001 for ₹11,800.00.");
  });

  it("round-trips quoted csv", () => {
    const csv = toCsv([{ name: 'Lakshmi, "Sweets"', city: "Coimbatore" }], ["name", "city"]);
    const objects = rowsToObjects(parseCsv(csv));
    expect(objects).toEqual([{ name: 'Lakshmi, "Sweets"', city: "Coimbatore" }]);
  });
});

describe("plans", () => {
  it("gives the trial the Growth feature set", () => {
    const features = featuresFor({
      plan: "starter",
      subscription_status: "trialing",
      trial_ends_at: "2099-01-01T00:00:00Z",
    });
    expect(features.workflows).toBe(true);
    expect(features.seats).toBe(8);
  });
});
