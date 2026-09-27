// End-to-end: a parent finds a product by age, adds it to the cart and checks out with Cash on Delivery,
// verifying their phone by SMS code (development mode shows the code). Then staff see and confirm the order.
import { expect, test } from "@playwright/test";

test("guest COD checkout with phone verification, then staff confirm the order", async ({ page, request }) => {
  const phone = `017${String(Date.now()).slice(-8)}`;
  await page.goto("/?lang=en");
  await page.getByRole("link", { name: "0–6 months" }).first().click();
  await expect(page).toHaveURL(/age=0-6m/);
  await page.getByRole("link", { name: "Soft Cotton Romper" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Soft Cotton Romper");
  await expect(page.locator(".cert-badge")).toHaveCount(0); // no documented certificates in the seed data
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");

  await page.getByLabel("Full name *").fill("E2E Parent");
  await page.getByLabel("Mobile number *").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const devToast = page.locator(".toast", { hasText: "DEV code:" });
  await expect(devToast).toBeVisible();
  const code = (await devToast.textContent())!.match(/(\d{6})/)![1]!;
  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Verified ✓")).toBeVisible();

  await page.getByLabel("Division *").selectOption({ label: "Dhaka" });
  await page.getByLabel("District *").selectOption({ label: "Dhaka" });
  await page.getByLabel("Upazila / Thana *").selectOption({ label: "Mirpur" });
  await page.getByLabel("House, road, area *").fill("House 12, Road 3, Section 10");
  await expect(page.locator("#totals")).toContainText("Inside Dhaka City");
  await expect(page.locator("#totals")).toContainText("৳70");

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: /We've got your order/ })).toBeVisible();
  const orderNo = (await page.locator(".order-no").textContent())!.trim();
  expect(orderNo).toMatch(/^ZSB-\d{6}-[A-Z0-9]{4}$/);

  // Staff (order processor) signs in with phone + SMS code and confirms the verified order.
  const otp = await request.post("/api/admin/auth/otp/request", { data: { phone: "01899999999" }, headers: { "x-requested-with": "fetch" } });
  const devCode = (await otp.json()).devCode;
  const login = await request.post("/api/admin/auth/otp/verify", { data: { phone: "01899999999", code: devCode }, headers: { "x-requested-with": "fetch" } });
  expect(login.ok()).toBe(true);
  const list = await (await request.get(`/api/admin/orders?q=${orderNo}`)).json();
  expect(list.items[0].otp_verified).toBe(1);
  const confirm = await request.post(`/api/admin/orders/${list.items[0].id}/status`, { data: { status: "confirmed" }, headers: { "x-requested-with": "fetch" } });
  const body = await confirm.json();
  expect(body.order.invoice_no).toMatch(/^INV-BBY-\d{8}-\d{4}$/);

  // The customer's order page now offers the invoice PDF.
  await page.reload();
  await expect(page.getByRole("link", { name: /Download invoice/ })).toBeVisible();
});

test("an abandoned checkout is captured when the shopper leaves", async ({ page, request }) => {
  const phone = `018${String(Date.now()).slice(-8)}`;
  await page.goto("/product/diaper-pants?lang=en");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Full name *").fill("Left Early");
  await page.getByLabel("Mobile number *").fill(phone);
  await page.getByLabel("Full name *").focus(); // blur the phone field → autosave
  await expect.poll(async () => {
    const r = await request.get(`/api/checkout/resume/${await page.evaluate(() => JSON.parse(localStorage.getItem("zsb_sid") ?? '""'))}`);
    return r.ok() ? (await r.json()).customer.phone : null;
  }).toBe(phone);
});
