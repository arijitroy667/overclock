// Same-origin proxy to the FastAPI service (no CORS, and the browser never needs the API's address).
// A route handler rather than next.config rewrites: rewrite destinations are frozen at build time,
// so a built image could not be pointed at a different API.
export const dynamic = "force-dynamic";

const API_URL = () => process.env.API_URL ?? "http://localhost:8000";

async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_URL()}/api/v1/${path.join("/")}${new URL(request.url).search}`;
  const headers = new Headers();
  for (const name of ["authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
    });
  } catch {
    return Response.json({ detail: "Overclock’s server isn’t reachable right now." }, { status: 502 });
  }

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
