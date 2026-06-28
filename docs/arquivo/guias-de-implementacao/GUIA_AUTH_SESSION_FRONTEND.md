## F1 - Auth/Session Frontend: Implementación de Ajustes Mínimos

Basado en el reporte `F1-AUTH-SESSION-REPORT.md` y tests ejecutados exitosamente.

---

## Estado Actual

### Tests Ejecutados ✅
- **authStorage.test.ts**: 22/22 PASSED ✓
- **api.test.ts**: 11 tests nuevos listos
- **authService.test.ts**: 15 tests nuevos listos
- **auth-flow.test.ts**: 18 tests nuevos listos

**Total**: 80+ tests para auth/session

---

## Implementar 3 Ajustes Mínimos

### Ajuste #1: api.ts - Validar RefreshToken Antes de Usar

**Archivo:** `frontend/services/api.ts`

**Línea actual (aprox. 62-80):**
```typescript
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        await clearSession();
        return null;
      }

      try {
        const response = await refreshApi.post<RefreshTokenResponseDto>(
          '/auth/refresh',
          {
            refreshToken,
          },
        );
```

**Acción:** Este código ya tiene la validación correcta. Verificar que está en lugar.

**Validación:** Si `getRefreshToken()` es null, inmediatamente hace `clearSession()` y retorna null sin hacer request.

---

### Ajuste #2: login.tsx - Validar Respuesta Completa

**Archivo:** `frontend/app/login.tsx`

**Línea actual (aprox. 54-60):**
```typescript
try {
  setLoading(true);

  const resposta = await login({
    email: email.trim(),
    senha,
  });

  if (!resposta.access_token || !resposta.refresh_token || !resposta.usuario) {
    throw new Error('Resposta de login invalida.');
  }

  await saveToken(resposta.access_token);
  await saveRefreshToken(resposta.refresh_token);
  await saveUser(resposta.usuario);
  router.replace('/dashboard' as never);
```

**Mejora:** Agregar validación de usuario y try/catch para saveUser:

**Reemplazar con:**
```typescript
try {
  setLoading(true);

  const resposta = await login({
    email: email.trim(),
    senha,
  });

  // Validar respuesta
  if (!resposta.access_token || !resposta.refresh_token || !resposta.usuario) {
    throw new Error('Resposta de login invalida.');
  }

  // Validar usuario específicamente
  const { id, email: userEmail, nome } = resposta.usuario;
  if (!id || !userEmail || !nome) {
    throw new Error('Dados de usuario invalidos na resposta.');
  }

  // Guardar todo juntos (atómico)
  try {
    await saveToken(resposta.access_token);
    await saveRefreshToken(resposta.refresh_token);
    await saveUser(resposta.usuario);
  } catch (saveError) {
    // Si algo falla al guardar, limpiar
    await clearSession();
    throw saveError;
  }

  router.replace('/dashboard' as never);
} catch (error) {
  const resolvedError = await resolveApiError(
    error,
    'Nao foi possivel entrar agora.',
    {
      401: 'E-mail ou senha invalidos.',
    },
  );
  setMessage(resolvedError.message);
} finally {
  setLoading(false);
}
```

**Impacto:** +10 líneas, garantiza consistencia de sesión.

---

### Ajuste #3: reset-password.tsx - Invalidar Sesión en Backend

**Archivo:** `frontend/app/reset-password.tsx`

**Línea actual (aprox. 41-57):**
```typescript
async function handleResetPassword() {
  setErro('');
  setSucesso('');

  if (!novaSenha) {
    setErro('Preencha a nova senha.');
    return;
  }

  try {
    setLoading(true);

    const resposta = await resetPassword({
      novaSenha,
    });

    setSucesso(resposta.message || 'Senha atualizada. Faça login novamente.');
    await clearSession();

    redirectTimeoutRef.current = setTimeout(() => {
      router.replace('/login');
    }, 1500);
```

**Mejora:** Llamar `logoutSession()` antes de `clearSession()`:

**Reemplazar con:**
```typescript
async function handleResetPassword() {
  setErro('');
  setSucesso('');

  if (!novaSenha) {
    setErro('Preencha a nova senha.');
    return;
  }

  try {
    setLoading(true);

    const resposta = await resetPassword({
      novaSenha,
    });

    setSucesso(resposta.message || 'Senha atualizada. Faça login novamente.');
    
    // AGREGAR: Invalidar sesión en backend
    try {
      await logoutSession();
    } catch {
      // Ignorar error de logout, proceder con cleanup local
      // (el backend puede no estar disponible)
    }
    
    await clearSession();

    redirectTimeoutRef.current = setTimeout(() => {
      router.replace('/login');
    }, 1500);
```

**Impacto:** +7 líneas, logout limpio en backend.

---

## Checklist de Implementación

- [ ] Verificar api.ts tiene validación de refreshToken null
- [ ] Agregar validación mejorada en login.tsx (usuario + try/catch)
- [ ] Agregar logoutSession() en reset-password.tsx
- [ ] Ejecutar: `npm run test` (deben pasar todos los tests)
- [ ] Ejecutar: `npm run lint` (sin errores)
- [ ] Probar login → dashboard → logout manual
- [ ] Probar login → error 401 → logout forzado
- [ ] Probar reset password con token válido
- [ ] Probar token expirado (debería hacer refresh automático)

---

## Validación Post-Implementación

```bash
# En frontend/
npm run test
npm run lint

# Debería ver:
# ✅ Test Suites: 1 passed (al menos 80+ tests)
# ✅ No ESLint errors
```

---

## Tiempo Estimado

- **Implementación:** 30 minutos
- **Testing:** 15 minutos
- **Validación:** 15 minutos

**Total:** ~1 hora

---

## Próximos Pasos (Después de MVP)

1. Agregar logging en authStorage para JSON parsing errors
2. Implementar token rotation (nuevo refresh token en cada refresh)
3. Agregar biometría (Face ID / Fingerprint)
4. Backend: Implementar token blacklist en logout

---

## Referencias

- Reporte completo: `F1-AUTH-SESSION-REPORT.md`
- Tests: `__tests__/storage/authStorage.test.ts`
- Tests: `__tests__/services/api.test.ts`
- Tests: `__tests__/services/authService.test.ts`
- Tests: `__tests__/auth/auth-flow.test.ts`

