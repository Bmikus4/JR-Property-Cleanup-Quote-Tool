export async function POST(request: Request) {
  const { mode, name, email, secret } = await request.json();

  // Admin bypass: validated server-side against a secret that never ships to
  // the client. Denied if the env var is unset, so it fails closed.
  if (mode === "admin") {
    const adminSecret = (process.env.ADMIN_SECRET || "").trim();
    if (!adminSecret || typeof secret !== "string" || secret !== adminSecret) {
      return Response.json({ error: "Invalid admin secret" }, { status: 401 });
    }
    return Response.json({ success: true, name: "Admin", email: "admin@jrpropertycleanup.com" });
  }

  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });
  if (mode === "signup" && !name) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!["login", "signup"].includes(mode)) return Response.json({ error: "Invalid mode" }, { status: 400 });

  const webhookUrl = (process.env.N8N_JR_AUTH_WEBHOOK_URL || "").trim();

  if (!webhookUrl) {
    console.log("[DEV BYPASS] Auth webhook skipped.", { mode, name, email });
    const devName = mode === "signup" ? name : email.split("@")[0];
    return Response.json({ success: true, name: devName });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, name, email }),
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return Response.json(data, { status: res.ok ? 200 : res.status });
    } catch {
      console.error("Auth webhook returned non-JSON:", text.slice(0, 200));
      return Response.json({ error: "Auth service returned invalid response" }, { status: 502 });
    }
  } catch (err) {
    console.error("Auth webhook fetch failed:", err);
    return Response.json({ error: "Could not reach auth service" }, { status: 502 });
  }
}
