import { test, expect, Page, APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import {
  resolveConfig,
  withGuardedDatabase,
} from "../../../backendnest/test/e2e-runtime.cjs";

const proof = JSON.parse(readFileSync(process.env.ACCESS_BINDING!, "utf8")) as {
  scope: string;
  runId: string;
  webUrl: string;
  apiUrl: string;
  sourceDigest: string;
};
const database = resolveConfig(process.env);
type Account = ReturnType<typeof account>;
function account() {
  const suffix = String(randomInt(10_000_000_000, 99_999_999_999));
  return {
    nome: `Access fixture ${suffix}`,
    email: `access-${suffix}@example.test`,
    cpf: suffix,
    cep: "01001000",
    endereco: "Rua de teste",
    numero: "10",
    cidade: "Cidade de teste",
    senha: "Access-Fixture-42!",
    aceitoPoliticaPrivacidade: true,
  };
}
async function sql(text: string, parameters?: unknown[]) {
  return withGuardedDatabase(
    database,
    process.env,
    async (client) => (await client.query(text, parameters)).rows,
  );
}
async function registerAPI(request: APIRequestContext, input: Account) {
  expect(
    (
      await request.post(proof.apiUrl + "/auth/register", { data: input })
    ).status(),
  ).toBe(201);
}
async function login(page: Page, input: Account, password = input.senha) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@exemplo.com").fill(input.email);
  await page.getByPlaceholder("Sua senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("button", { name: "Abrir perfil do usuário" }),
  ).toBeVisible();
}
async function profile(page: Page, input: Account) {
  await page.goto("/usuario");
  await expect(page).toHaveURL(/\/usuario$/);
  await expect
    .poll(() =>
      page
        .locator("input")
        .evaluateAll(
          (nodes, email) =>
            nodes.some((node) => (node as HTMLInputElement).value === email),
          input.email,
        ),
    )
    .toBe(true);
}
async function returnToDashboard(page: Page) {
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Synthetic accounts have zero balance. This appears only after dashboard,
  // budgets and goals finish; going offline earlier correctly hides the shell.
  await expect(
    page
      .getByText("Mes com saldo positivo", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
}
async function fillRegistration(page: Page, input: Account) {
  await page.goto("/register");
  // Auxiliary CEP is synthetic; auth/session requests reach real Nest/PostgreSQL.
  await page.route("**/cep/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": proof.webUrl },
      body: JSON.stringify({
        success: true,
        data: {
          cep: input.cep,
          endereco: input.endereco,
          cidade: input.cidade,
        },
      }),
    }),
  );
  await page.getByPlaceholder("Seu nome completo").fill(input.nome);
  await page.getByPlaceholder("voce@exemplo.com").fill(input.email);
  await page.getByPlaceholder("000.000.000-00").fill(input.cpf);
  await page.getByPlaceholder("00000-000").fill(input.cep);
  await expect(page.getByPlaceholder("Rua, avenida ou logradouro")).toHaveValue(
    input.endereco,
  );
  await page.getByPlaceholder("123 ou S/N").fill(input.numero);
  await page.getByPlaceholder("Sua cidade").fill(input.cidade);
  await page.getByPlaceholder("Entre 6 e 64 caracteres").fill(input.senha);
  await page
    .getByPlaceholder("Repita a senha", { exact: true })
    .fill(input.senha);
  await page.getByRole("checkbox").check({ position: { x: 10, y: 10 } });
}
async function completeAccount(input: Account) {
  const rows = await sql(
    `SELECT u.id,count(c.id)::int AS categories FROM usuario u
    LEFT JOIN categoria c ON c.usuario_id=u.id WHERE u.email=$1 GROUP BY u.id`,
    [input.email],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].categories).toBe(8);
}
async function expire(input: Account, kind: "idle" | "absolute") {
  const values =
    kind === "idle"
      ? "authenticated_at=t.n-interval '1000 seconds',last_activity_at=t.n-interval '901 seconds',absolute_expires_at=t.n+interval '42200 seconds',refresh_expires_at=LEAST(auth_session.refresh_expires_at,t.n+interval '42200 seconds')"
      : "authenticated_at=t.n-interval '43201 seconds',last_activity_at=t.n-interval '2 seconds',absolute_expires_at=t.n-interval '1 second',refresh_expires_at=LEAST(auth_session.refresh_expires_at,t.n-interval '1 second')";
  await sql(
    `WITH t AS MATERIALIZED (SELECT clock_timestamp() AS n) UPDATE auth_session SET ${values}
    FROM t WHERE usuario_id=(SELECT id FROM usuario WHERE email=$1) AND revoked_at IS NULL`,
    [input.email],
  );
}

test.beforeAll(async ({ request }) => {
  expect(
    (await (
      await request.get(proof.webUrl + "/_access-proof")
    ).json()) as unknown,
  ).toMatchObject({
    scope: "DISPOSABLE_ACCESS_WEB",
    runId: proof.runId,
    sourceDigest: proof.sourceDigest,
  });
  await sql("SELECT 1");
});

test("actual registration, invalid login, access, logout, back and reload", async ({
  page,
}) => {
  const input = account();
  await page.goto("/usuario");
  await expect(page).toHaveURL(/\/login$/);
  await fillRegistration(page, input);
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let submissions = 0;
  await page.route("**/auth/register", async (route) => {
    submissions++;
    const response = await route.fetch();
    entered();
    await held;
    await route.fulfill({ response });
  });
  try {
    const button = page.getByRole("button", {
      name: "Criar conta",
      exact: true,
    });
    await button.dblclick();
    await reached;
    await expect(
      page.getByRole("button", { name: "Criando...", exact: true }),
    ).toBeDisabled();
    expect(submissions).toBe(1);
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/login$/);
  await page.unroute("**/auth/register");
  await completeAccount(input);

  const duplicate = { ...account(), cpf: input.cpf };
  await fillRegistration(page, duplicate);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByText("Este CPF ja esta cadastrado.")).toBeVisible();
  expect(
    await sql("SELECT id FROM usuario WHERE email=$1", [duplicate.email]),
  ).toEqual([]);
  await page.goto("/login");
  await page.getByPlaceholder("voce@exemplo.com").fill(input.email);
  await page
    .getByPlaceholder("Sua senha", { exact: true })
    .fill("Wrong-Fixture-42!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText(/E-mail ou senha invalidos|E-mail ou senha incorretos/),
  ).toBeVisible();
  await login(page, input);
  await page.getByRole("button", { name: "Abrir perfil do usuário" }).click();
  await expect(page).toHaveURL(/\/usuario$/);
  await returnToDashboard(page);
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("registration rollback, lost success response and retry leave one complete account", async ({
  page,
}) => {
  const input = account();
  await fillRegistration(page, input);
  await sql(`CREATE FUNCTION access_registration_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.nome='Freelance' THEN RAISE EXCEPTION 'synthetic category failure'; END IF; RETURN NEW; END $$`);
  await sql(
    "CREATE TRIGGER access_registration_failure BEFORE INSERT ON categoria FOR EACH ROW EXECUTE FUNCTION access_registration_failure()",
  );
  try {
    const failed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/auth/register") && response.status() === 500,
    );
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await failed;
    expect(
      await sql("SELECT id FROM usuario WHERE email=$1", [input.email]),
    ).toEqual([]);
  } finally {
    await sql("DROP TRIGGER access_registration_failure ON categoria");
    await sql("DROP FUNCTION access_registration_failure()");
  }
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toBeEnabled();
  await page.route(
    "**/auth/register",
    async (route) => {
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    },
    { times: 1 },
  );
  const lost = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/auth/register"),
  );
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await lost;
  await expect(
    page.getByText(
      "Nao foi possivel confirmar a criacao da conta. Ela pode ter sido criada. Tente entrar ou recuperar sua senha pelo login.",
      { exact: true },
    ),
  ).toBeVisible();
  await completeAccount(input);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByText("Este e-mail ja esta cadastrado.")).toBeVisible();
  await completeAccount(input);
  await login(page, input);
});

test("offline reconfirmation, recovery and local logout survive reload", async ({
  page,
  context,
  request,
}) => {
  const input = account();
  await registerAPI(request, input);
  await login(page, input);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(
    page.getByText("Tentar novamente", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir perfil do usuário" }),
  ).toHaveCount(0);
  await context.setOffline(false);
  await page.getByText("Tentar novamente", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Abrir perfil do usuário" }),
  ).toBeVisible();
  await profile(page, input);
  await returnToDashboard(page);
  const warnings: string[] = [];
  page.on("dialog", async (dialog) => {
    warnings.push(dialog.message());
    await dialog.accept();
  });
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => warnings.some((message) => /nao foi confirmada/.test(message)))
    .toBe(true);
  await context.setOffline(false);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("a held terminal A response cannot clear B and logout propagates across tabs", async ({
  page,
  context,
  request,
}) => {
  const first = account(),
    second = account();
  await registerAPI(request, first);
  await registerAPI(request, second);
  await login(page, first);
  await page.goto("/contas");
  await expect(
    page.getByRole("button", { name: "Atualizar lista", exact: true }),
  ).toBeVisible();
  await expire(first, "idle");
  let release!: () => void, captured!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const reached = new Promise<void>((resolve) => (captured = resolve));
  await page.route(
    "**/contas",
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(401);
      captured();
      await held;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  try {
    await page
      .getByRole("button", { name: "Atualizar lista", exact: true })
      .click();
    await reached;
    const other = await context.newPage();
    await login(other, second);
    release();
    await profile(other, second);
    await page.bringToFront();
    await profile(page, second);
    await other.bringToFront();
    await returnToDashboard(other);
    await other
      .getByRole("button", { name: "Sair da conta", exact: true })
      .click();
    await expect(other).toHaveURL(/\/login$/);
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login$/);
    await other.close();
  } finally {
    release();
  }
});

test("real idle and absolute expiry reject still-present credentials", async ({
  page,
  request,
}) => {
  const input = account();
  await registerAPI(request, input);
  await login(page, input);
  await expire(input, "idle");
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, input);
  await expire(input, "absolute");
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  const terminal = await sql(
    `SELECT terminal_reason FROM auth_session
    WHERE usuario_id=(SELECT id FROM usuario WHERE email=$1) ORDER BY authenticated_at`,
    [input.email],
  );
  expect(terminal.map((row) => row.terminal_reason).sort()).toEqual([
    "AUTH_SESSION_ABSOLUTE_EXPIRED",
    "AUTH_SESSION_IDLE_EXPIRED",
  ]);
});

test("actual password recovery and authenticated change permit subsequent login", async ({
  page,
  request,
}) => {
  const input = account();
  await registerAPI(request, input);
  await page.goto("/forgot-password");
  await page.getByPlaceholder("voce@exemplo.com").fill(input.email);
  const response = page.waitForResponse((reply) =>
    reply.url().endsWith("/auth/forgot-password"),
  );
  await page
    .getByRole("button", { name: "Enviar instrucoes", exact: true })
    .click();
  const recovery = (await (await response).json()) as {
    data: { resetToken: string };
  };
  expect(typeof recovery.data.resetToken).toBe("string");
  const recovered = "Recovered-Fixture-42!";
  await page.goto(
    "/reset-password-token?token=" +
      encodeURIComponent(recovery.data.resetToken),
  );
  await page.getByPlaceholder("Entre 6 e 64 caracteres").fill(recovered);
  await page.getByPlaceholder("Repita a nova senha").fill(recovered);
  await page
    .getByRole("button", { name: "Redefinir senha", exact: true })
    .click();
  await expect(
    page.getByText(/Senha.*redefinida|Senha.*atualizada/),
  ).toBeVisible();
  await login(page, input, recovered);
  await profile(page, input);
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await page.getByPlaceholder("Digite sua senha atual").fill(recovered);
  const changed = "Changed-Fixture-42!";
  await page.getByPlaceholder("Entre 6 e 64 caracteres").fill(changed);
  await page.getByPlaceholder("Repita a nova senha").fill(changed);
  await page
    .getByRole("button", { name: "Atualizar senha", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, input, changed);
});
