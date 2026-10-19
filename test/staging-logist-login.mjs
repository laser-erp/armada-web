/**
 * Логин супера/логиста для verify-admin и Playwright: INN приоритетнее телефона.
 * Значения секретов в лог не выводить.
 */
export function stagingLogistLoginFromEnv() {
  const inn = String(process.env.STAGING_LOGIST_INN || '').trim();
  if (inn) return { login: inn, source: 'STAGING_LOGIST_INN' };
  const phone = String(process.env.STAGING_LOGIST_PHONE || '').trim();
  if (phone) return { login: phone, source: 'STAGING_LOGIST_PHONE' };
  return { login: '', source: '' };
}
