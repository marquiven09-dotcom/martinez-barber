import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const siteUrl = Deno.env.get("SITE_URL") || "/";

  if (!code) {
    return Response.redirect(`${siteUrl}/admin/sistema?google=error`, 302);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI")!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error(await tokenRes.text());
      return Response.redirect(`${siteUrl}/admin/sistema?google=error`, 302);
    }

    const tokens = await tokenRes.json();

    // Averiguamos qué cuenta de Google se ha conectado, solo para mostrarlo
    // en el panel (nunca se muestra el token).
    let connectedEmail = "conectado";
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        connectedEmail = info.email ?? connectedEmail;
      }
    } catch (_e) { /* no crítico */ }

    const supabase = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Google solo manda refresh_token la primera vez que se autoriza (o si
    // se fuerza con prompt=consent, que es lo que hacemos en google-oauth-start).
    // Si por lo que sea no llega uno nuevo, conservamos el que ya teníamos
    // guardado en vez de borrarlo.
    const { data: existing } = await supabase
      .from("google_tokens").select("refresh_token").eq("id", 1).maybeSingle();

    await supabase.from("google_tokens").upsert({
      id: 1,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      connected_email: connectedEmail,
      updated_at: new Date().toISOString(),
    });

    await supabase.from("settings").update({ valor: "true" }).eq("clave", "google_calendar_connected");
    await supabase.from("settings").update({ valor: JSON.stringify(connectedEmail) }).eq("clave", "google_calendar_email");

    return Response.redirect(`${siteUrl}/admin/sistema?google=ok`, 302);
  } catch (err) {
    console.error(err);
    return Response.redirect(`${siteUrl}/admin/sistema?google=error`, 302);
  }
});
