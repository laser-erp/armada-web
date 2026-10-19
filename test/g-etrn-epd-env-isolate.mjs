/**
 * g-etrn.test.mjs: изоляция EPD_* от shell (armada-api step0 задаёт EPD_API_KEY=test).
 * Импортировать первым в g-etrn.test.mjs — до g-etrn-harness.
 */
const saved = {
  apiKey: process.env.EPD_API_KEY,
  sandbox: process.env.EPD_SANDBOX,
};

delete process.env.EPD_API_KEY;
delete process.env.EPD_SANDBOX;

export function restoreEpdTestEnv() {
  if (saved.apiKey === undefined) delete process.env.EPD_API_KEY;
  else process.env.EPD_API_KEY = saved.apiKey;
  if (saved.sandbox === undefined) delete process.env.EPD_SANDBOX;
  else process.env.EPD_SANDBOX = saved.sandbox;
}

process.on('exit', () => {
  restoreEpdTestEnv();
});
