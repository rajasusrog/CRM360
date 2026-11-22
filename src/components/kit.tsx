import { cn } from "cn";

export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-1 text-xs tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl leading-tight tracking-tight">{title}</h1>
        {lede ? <p className="mt-1.5 text-sm text-muted-foreground">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  children,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
      >
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
      />
    </label>
  );
}

export function CheckField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span>{label}</span>
    </label>
  );
}

export function EmptyState({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{lede}</p>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl bg-card p-4 ring-1 ring-foreground/10", className)}>{children}</section>;
}

export function formGrid(children: React.ReactNode) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
