import Container from "@/components/shared/Container";

export default function UnderConstruction({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <Container className="py-16">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold text-brand-800">{title}</h1>
        <p className="mt-3 text-zinc-600">
          {note ?? "This page is under construction. Check back soon."}
        </p>
      </div>
    </Container>
  );
}
