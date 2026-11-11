import { test, expect } from "@playwright/test";

test("real category creation, immutable edit and reload preserve both natures", async ({
  page,
  request,
}, testInfo) => {
  const endpoint = process.env.FINANCIAL_API_URL!;
  const password = process.env.FINANCIAL_TEST_PASSWORD!;
  const email = "financial-browser@example.com";
  const registered = await request.post(endpoint + "/auth/register", {
    data: {
      nome: "Financial browser",
      email,
      cpf: "11144477735",
      cep: "01001000",
      endereco: "Test street",
      numero: "1",
      cidade: "Test city",
      senha: password,
      aceitoPoliticaPrivacidade: true,
    },
  });
  expect(registered.status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  const loginPromise = page.waitForResponse(
    (r) =>
      r.url() === endpoint + "/auth/login" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const login = await loginPromise;
  expect(login.status()).toBe(200);
  const token = (await login.json()).data.access_token as string;
  await expect(page).not.toHaveURL(/\/login$/);
  for (const [tipo, label] of [
    ["receita", "Receita"],
    ["despesa", "Despesa"],
  ] as const) {
    await page.goto("/categorias-form");
    await page
      .getByLabel("Nome da categoria", { exact: true })
      .fill("Browser " + tipo);
    await page.getByRole("button", { name: label, exact: true }).click();
    const createdPromise = page.waitForResponse(
      (r) =>
        r.url() === endpoint + "/categorias" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Salvar categoria", exact: true })
      .click();
    const created = await createdPromise;
    expect(created.status()).toBe(201);
    const category = (await created.json()).data as {
      id: string;
      tipo: string;
    };
    expect(category.tipo).toBe(tipo);
    await page.goto("/categorias-form?id=" + category.id);
    await expect(page.getByLabel("Nome da categoria")).toHaveValue(
      "Browser " + tipo,
    );
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Nome da categoria").fill("Renamed " + tipo);
    const savedPromise = page.waitForResponse(
      (r) =>
        r.url() === endpoint + "/categorias/" + category.id &&
        r.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Salvar categoria", exact: true })
      .click();
    const saved = await savedPromise;
    expect(saved.status()).toBe(200);
    expect(saved.request().postDataJSON()).toEqual({ nome: "Renamed " + tipo });
    await page.goto("/categorias-form?id=" + category.id);
    await page.reload();
    await expect(page.getByLabel("Nome da categoria")).toHaveValue(
      "Renamed " + tipo,
    );
    const persisted = await request.get(
      endpoint + "/categorias/" + category.id,
      { headers: { Authorization: "Bearer " + token } },
    );
    expect(persisted.status()).toBe(200);
    expect((await persisted.json()).data).toMatchObject({
      id: category.id,
      nome: "Renamed " + tipo,
      tipo,
    });
    await page.screenshot({
      path: testInfo.outputPath("category-" + tipo + "-reloaded.png"),
    });
  }
});
