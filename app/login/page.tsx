import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Footer } from "@/components/Footer";
import { BrandMark } from "@/components/Brand";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "OWNER" ? "/owner" : "/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[24rem]">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandMark size={40} />
            <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.02em]">
              Deposit<span className="text-ink3">Book</span>
            </h1>
            <p className="mt-1 text-sm text-ink2">
              Daily store deposit records
            </p>
          </div>

          <div className="card">
            <div className="panel-head">
              <span className="panel-title">Sign in</span>
            </div>
            <div className="p-5">
              <LoginForm />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-ink3">
            Trouble signing in? Contact the office.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
