import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startSocialLogin } from "./actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function SocialButtons() {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <form action={startSocialLogin}>
          <input type="hidden" name="provider" value="google" />
          <Button type="submit" variant="outline" className="h-10 w-full">
            <GoogleIcon /> Google
          </Button>
        </form>
        <form action={startSocialLogin}>
          <input type="hidden" name="provider" value="microsoft" />
          <Button type="submit" variant="outline" className="h-10 w-full">
            <MicrosoftIcon /> Microsoft
          </Button>
        </form>
      </div>
      <Button variant="outline" className="h-10 w-full" render={<Link href="/login/sso" />} nativeButton={false}>
        <Building2 /> Ingresar con SSO de mi empresa
      </Button>
    </div>
  );
}

export function Divider({ label = "o con tu correo" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
