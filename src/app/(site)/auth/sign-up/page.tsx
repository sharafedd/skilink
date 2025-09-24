import { signUpAction } from "../actions";

export const metadata = { title: "Sign up — Skilink" };

export default function SignUpPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-800">Create your account</h1>
      <p className="mt-2 text-sm text-zinc-600">Join Skilink to hire pros or offer services.</p>

      <form action={signUpAction} className="card mt-6 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input name="name" required className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" name="email" required className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" name="password" required minLength={6} className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>
        <button className="w-full rounded-md bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700">Create account</button>
        <p className="text-xs text-zinc-500">By creating an account you agree to our Terms and Privacy Policy.</p>
      </form>

      <p className="mt-4 text-sm text-zinc-700">
        Already have an account? <a href="/auth/sign-in" className="text-brand-700 underline">Sign in</a>.
      </p>
    </div>
  );
}
