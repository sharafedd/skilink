export const metadata = { title: "Check your email — Skilink" };

export default function CheckEmailPage({ searchParams }: { searchParams?: { email?: string } }) {
  const email = searchParams?.email ?? "";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-brand-800">Verify your email</h1>
      <p className="mt-3 text-zinc-600">
        We sent a confirmation link to {email || "your inbox"}. Click it to activate your account.
      </p>
      <p className="mt-2 text-sm text-zinc-500">Didn’t receive it? Check spam or try resending.</p>
    </div>
  );
}
