// El botón "Conectar Google Calendar" del panel abre esta URL.
// Redirige a Darío a la pantalla de permisos de Google.
Deno.serve(async (req) => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",   // imprescindible para recibir un refresh_token
    prompt: "consent",        // fuerza a Google a darnos siempre el refresh_token
    scope: "https://www.googleapis.com/auth/calendar",
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    302,
  );
});
