import { signInAction } from "../actions";

export const metadata = { title: "Sign in — Skilink" };

export default function SignInPage({ searchParams }: { searchParams?: { error?: string; email?: string } }) {
  const err = searchParams?.error;
  const email = searchParams?.email ?? "";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-800">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">Welcome back!</p>

      {err && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err === "Email not confirmed"
            ? "Please verify your email address. We sent you a confirmation link."
            : err}
        </div>
      )}

      <form action={signInAction} className="card mt-4 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input defaultValue={email} type="email" name="email" required className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" name="password" required className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700">Sign in</button>
      </form>

      <p className="mt-3 text-sm text-zinc-700">
        Didn’t get the email? Check spam or{" "}
        <a href="/auth/check-email" className="text-brand-700 underline">resend</a>.
      </p>
    </div>
  );
}
