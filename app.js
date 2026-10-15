// ---- CONFIG: edit these two lines ----
const CONFIG = {
  API: "https://api.mirage.cupx.in/create",   // your Worker URL + /create
  SITEKEY: "YOUR_TURNSTILE_SITE_KEY"
};
// --------------------------------------
const $ = id => document.getElementById(id);
let wid = null;
window.onTs = () => { wid = turnstile.render("#ts", { sitekey: CONFIG.SITEKEY, theme: "auto" }); };

function sync() {
  $("tc").textContent = $("t").value.length + "/70";
  $("dc").textContent = $("d").value.length + "/200";
  $("pt").textContent = $("t").value || "Your title appears here";
  $("pd").textContent = $("d").value || "Your description appears here";
}
$("t").addEventListener("input", sync);
$("d").addEventListener("input", sync);

$("go").addEventListener("click", async () => {
  $("err").textContent = "";
  const title = $("t").value.trim();
  if (!title) { $("err").textContent = "Enter a title."; return; }
  const token = wid !== null ? turnstile.getResponse(wid) : "";
  if (!token) { $("err").textContent = "Complete the captcha first."; return; }
  $("go").disabled = true;
  try {
    const r = await fetch(CONFIG.API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: $("d").value, token })
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || "Something went wrong.");
    $("lnk").href = j.url; $("lnk").textContent = j.url;
    $("res").hidden = false;
  } catch (e) {
    $("err").textContent = e.message;
  } finally {
    $("go").disabled = false;
    if (wid !== null) turnstile.reset(wid);
  }
});

$("cp").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("lnk").textContent); $("cp").textContent = "Copied"; }
  catch { $("cp").textContent = "Copy failed"; }
  setTimeout(() => $("cp").textContent = "Copy", 1500);
});
