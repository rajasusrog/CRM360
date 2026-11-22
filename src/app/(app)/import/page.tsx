import { ActionForm, Submit } from "@/components/action-form";
import { PageHeader, TextAreaField, SelectField } from "@/components/kit";
import { requireStaff } from "@/lib/session";
import { importCsv } from "@/server/actions/crm";

export default async function ImportPage() {
  await requireStaff();
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Data" title="Import CSV" lede="First row is the header. Leads: first_name, last_name, email, phone, company, source, city. Clients: name, entity_type, gstin, city, state_code. Add consent=yes when the person agreed." />
      <ActionForm action={importCsv}>
        <SelectField label="Module" name="module" defaultValue="leads">
          <option value="leads">Leads</option>
          <option value="contacts">Contacts</option>
          <option value="clients">Clients</option>
        </SelectField>
        <TextAreaField label="CSV" name="csv" rows={10} defaultValue={"first_name,last_name,company,phone,source,city,consent\nMeena,Krishnan,Meena Boutique,9841112233,walk-in,Chennai,yes"} />
        <Submit>Import</Submit>
      </ActionForm>
    </div>
  );
}
