export function TotalExperience({ years }: { years: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
      <p className="text-dense text-card-foreground">
        Total experience{' '}
        <strong className="font-medium">
          {years} {years === 1 ? 'year' : 'years'}
        </strong>
      </p>
      <p className="mt-1 text-meta text-muted-foreground">
        Worked out from the jobs below whenever you save, so two held at once count once. To change
        it, fix the dates.
      </p>
    </div>
  );
}
