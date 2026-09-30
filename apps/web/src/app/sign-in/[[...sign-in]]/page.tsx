import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center gap-4 p-4">
      <SignIn />
      <Link href="/welcome" className="nb-btn px-4 text-sm">What is Overclock?</Link>
    </main>
  );
}
