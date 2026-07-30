import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";
import { isSupabaseConfigured } from "@/server/supabase";

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    return <LoginClient configured={false} />;
  }
  return <LoginClient configured />;
}
