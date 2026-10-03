import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino de los enlaces de correo (invitación, recuperación). Canjea el token en
// el servidor y deja la sesión en cookies.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const rawNext = params.get("next") ?? "/app";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "El enlace no es válido o ya expiró. Pide una nueva invitación.");
  return NextResponse.redirect(url);
}
