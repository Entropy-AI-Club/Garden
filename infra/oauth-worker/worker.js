/**
 * Minimal GitHub OAuth proxy for Decap CMS, deployed as a Cloudflare Worker.
 *
 * GitHub Pages can't run server code, so Decap's GitHub backend (which needs
 * to exchange an OAuth code for an access token using a client secret) needs
 * somewhere else to do that exchange. This worker is that "somewhere else" —
 * it does nothing but the OAuth handshake described at
 * https://decapcms.org/docs/backends-overview/#using-github-with-an-oauth-proxy
 *
 * Routes:
 *   GET /auth      Redirects the user to GitHub's OAuth authorize page.
 *   GET /callback  Exchanges the returned code for a token, then hands it
 *                  back to the Decap CMS popup window via postMessage.
 *
 * Required Worker secrets (set with `wrangler secret put <NAME>`):
 *   GITHUB_CLIENT_ID      OAuth App client ID
 *   GITHUB_CLIENT_SECRET  OAuth App client secret
 *
 * See docs/PLAN.md and the contributor README for the full setup steps.
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(url, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(url, request, env);
    }
    return new Response("Not found. Expected /auth or /callback.", { status: 404 });
  },
};

function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = new URL("/callback", url).toString();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo,user");
  authorizeUrl.searchParams.set("state", state);

  const response = Response.redirect(authorizeUrl.toString(), 302);
  const headers = new Headers(response.headers);
  // Short-lived cookie just to validate the state round-trip in /callback.
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
  return new Response(response.body, { status: response.status, headers });
}

async function handleCallback(url, request, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (request.headers.get("Cookie") || "").match(/oauth_state=([^;]+)/)?.[1];

  if (!code) {
    return htmlResponse(renderResult("error", { message: "Missing OAuth code." }), 400);
  }
  if (!state || state !== cookieState) {
    return htmlResponse(renderResult("error", { message: "Invalid OAuth state." }), 400);
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "entropy-ai-club-decap-oauth-worker",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const result = await tokenResponse.json();

  if (result.error || !result.access_token) {
    return htmlResponse(renderResult("error", result), 401);
  }

  return htmlResponse(
    renderResult("success", { token: result.access_token, provider: "github" }),
    200
  );
}

function htmlResponse(body, status) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

// Decap's popup listens for a `message` event carrying this exact string
// format, then closes itself. See decapcms.org's OAuth proxy docs.
function renderResult(status, content) {
  return `<!doctype html>
<script>
  (function () {
    function receiveMessage(message) {
      window.opener.postMessage(
        "authorization:github:${status}:${JSON.stringify(content)}",
        message.origin
      );
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", "*");
  })();
</script>`;
}
