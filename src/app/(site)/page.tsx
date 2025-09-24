import { getCurrentUser } from "@/lib/auth";
import UnderConstruction from "@/components/shared/UnderConstruction";

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold">
        {user ? `Hello ${user.name}!` : "Welcome to Skilink"}
      </h1>

      {/* remove after you build the real sections */}
      <div className="mt-6">
        <UnderConstruction title="Home feed" note="Trending, categories, and recommendations coming soon." />
      </div>
    </div>
  );
}
