/** Pantalla de acceso: iniciar sesión o crear cuenta (los proyectos se guardan en la cuenta). */
import { Api, ApiError } from "../lib/api";
import { session } from "../core/session";
import { h, ic, toast } from "../lib/dom";

export function mountAuth(host: HTMLElement, onDone: () => void): () => void {
  let mode: "login" | "register" = "login";
  const box = h("div", { class: "au-card" });
  const render = () => {
    const err = h("p", { class: "st-error", role: "alert", hidden: true });
    const name = h("input", { class: "st-input", type: "text", autocomplete: "name", required: true, maxlength: "80" });
    const email = h("input", { class: "st-input", type: "email", autocomplete: "email", required: true, maxlength: "254" });
    const pass = h("input", { class: "st-input", type: "password", autocomplete: mode === "login" ? "current-password" : "new-password", required: true, minlength: "8", maxlength: "128" });
    const submit = h("button", { type: "submit", class: "st-btn st-btn--primary st-btn--block" }, mode === "login" ? "Entrar" : "Crear mi cuenta");
    const form = h("form", { class: "au-form", novalidate: true },
      mode === "register" ? h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Tu nombre"), name) : null,
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Correo electrónico"), email),
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, mode === "login" ? "Contraseña" : "Contraseña (mínimo 8 caracteres)"), pass),
      err, submit);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      if (!email.value.includes("@")) { err.textContent = "Escribe un correo válido."; err.hidden = false; email.focus(); return; }
      if (mode === "register" && !name.value.trim()) { err.textContent = "Escribe tu nombre."; err.hidden = false; name.focus(); return; }
      if (pass.value.length < (mode === "register" ? 8 : 1)) { err.textContent = "La contraseña debe tener al menos 8 caracteres."; err.hidden = false; pass.focus(); return; }
      submit.disabled = true;
      submit.textContent = "Un momento…";
      try {
        const r = mode === "login" ? await Api.login(email.value.trim(), pass.value) : await Api.register(name.value.trim(), email.value.trim(), pass.value);
        session.user = r.user;
        toast(`Hola, ${r.user.name}`, "ok", 1500);
        onDone();
      } catch (ex) {
        err.textContent = (ex as ApiError).message;
        err.hidden = false;
        submit.disabled = false;
        submit.textContent = mode === "login" ? "Entrar" : "Crear mi cuenta";
      }
    });
    const closed = session.config && !session.config.registrationOpen;
    box.replaceChildren(
      h("h1", { class: "au-title" }, mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"),
      h("p", { class: "au-sub" }, "Tus proyectos se guardan en tu cuenta para que los recuperes desde cualquier dispositivo."),
      form,
      closed && mode === "login" ? h("p", { class: "au-switch" }, "El registro de nuevas cuentas está cerrado.") :
        h("p", { class: "au-switch" }, mode === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? ",
          h("button", { type: "button", class: "st-link", onclick: () => { mode = mode === "login" ? "register" : "login"; render(); } }, mode === "login" ? "Crear una cuenta" : "Iniciar sesión")));
    setTimeout(() => (mode === "register" ? name : email).focus(), 30);
  };
  render();
  host.replaceChildren(h("div", { class: "au" },
    h("a", { class: "au-brand", href: "/forja/" }, h("img", { src: "/forja/assets/img/icarus-logo-sm.webp", alt: "ICARUS", width: "120", height: "94" })),
    box,
    h("p", { class: "au-foot" }, ic("shield", 14), " Conexión protegida · No compartimos tus datos · ", h("a", { href: "/forja/" }, "Volver a ICARUS Website Builder"))));
  return () => {};
}
