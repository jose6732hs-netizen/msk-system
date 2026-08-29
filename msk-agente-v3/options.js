const $ = selector => document.querySelector(selector);
const status = text => { $("#status").textContent = text; };
const render = result => {
  const signed = !!result?.ok;
  $("#auth").hidden = signed; $("#account").hidden = !signed;
  $("#accountEmail").textContent = result?.user?.email || "Usuário MSK";
  status(signed ? "Conta pronta" : "Entre para continuar");
};
const authenticate = type => {
  const email = $("#email").value.trim(), password = $("#password").value;
  if (!email || password.length < 8) return status("Informe e-mail e senha com 8 caracteres.");
  status("Autenticando…");
  chrome.runtime.sendMessage({ type, email, password }, result => {
    if (!result?.ok) return status(result?.error || "Falha na autenticação.");
    if (result.confirmationRequired) return status("Confira seu e-mail para confirmar a conta.");
    render({ ok: true, user: result.user || result.session?.user });
  });
};
$("#login").addEventListener("click", () => authenticate("MSK_AUTH_LOGIN"));
$("#signup").addEventListener("click", () => authenticate("MSK_AUTH_SIGNUP"));
$("#logout").addEventListener("click", () => chrome.runtime.sendMessage({ type: "MSK_AUTH_LOGOUT" }, () => render(null)));
$("#openLovable").addEventListener("click", () => chrome.tabs.create({ url: "https://lovable.dev" }));
chrome.runtime.sendMessage({ type: "MSK_AUTH_STATUS" }, render);
