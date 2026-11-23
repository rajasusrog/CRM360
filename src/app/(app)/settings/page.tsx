import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, PageHeader, Panel, SelectField, TextAreaField } from "@/components/kit";
import { AI_EXTERNAL_NOTICE, canManageAiSettings } from "@/lib/ai/config";
import { getFirmAiStatus } from "@/lib/ai/gateway";
import { INDIAN_STATES, SAC_CODES } from "@/lib/constants";
import { formatDateTime, formatInr } from "@/lib/format";
import { PLANS, featuresFor } from "@/lib/plans";
import { requireStaff } from "@/lib/session";
import { SYSTEM_RULES } from "@/lib/compliance/rules";
import {
  activateLocalPlan,
  createField,
  createTemplate,
  createWorkflow,
  inviteStaff,
  overrideDueDay,
  renameStage,
  startSubscription,
  toggleWorkflow,
  updateAiSettings,
  updateFirm,
} from "@/server/actions/settings";

export default async function SettingsPage() {
  const session = await requireStaff();
  const canManage = session.profile.role === "owner" || session.profile.role === "partner";
  const plan = featuresFor(session.firm);
  const [staff, invites, stages, fields, workflows, templates, forms, audits, messages, aiStatus] = await Promise.all([
    session.supabase.from("profiles").select("id, full_name, email, role").eq("firm_id", session.firm.id).order("full_name"),
    session.supabase.from("invitations").select("email, role, token, accepted_at").eq("firm_id", session.firm.id).is("accepted_at", null),
    session.supabase.from("pipeline_stages").select("*").eq("firm_id", session.firm.id).order("position"),
    session.supabase.from("custom_field_defs").select("*").eq("firm_id", session.firm.id),
    session.supabase.from("workflow_rules").select("*").eq("firm_id", session.firm.id),
    session.supabase.from("message_templates").select("*").eq("firm_id", session.firm.id),
    session.supabase.from("web_forms").select("name, public_key").eq("firm_id", session.firm.id),
    session.supabase.from("audit_logs").select("action, entity_type, created_at").eq("firm_id", session.firm.id).order("created_at", { ascending: false }).limit(12),
    session.supabase.from("outbound_messages").select("channel, recipient, status, created_at").eq("firm_id", session.firm.id).order("created_at", { ascending: false }).limit(5),
    getFirmAiStatus(session.supabase, session.firm),
  ]);
  const seats = staff.data?.length ?? 0;
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
  const canManageAi = canManageAiSettings(session.profile.role);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Firm" title="Settings" lede={`${plan.name} · ${seats} of ${plan.seats} seats. Tamil strings cover the navigation; the rest of the desk is English. CSV import lives on the import page.`} action={<a className="text-sm underline" href="/import">Import CSV</a>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Firm profile</h2>
          {canManage ? (
            <ActionForm action={updateFirm} className="mt-3">
              <Field label="Name" name="name" defaultValue={session.firm.name} />
              <Field label="City" name="city" defaultValue={session.firm.city} />
              <SelectField label="State" name="state_code" defaultValue={session.firm.state_code}>
                {INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </SelectField>
              <Field label="Address" name="address" defaultValue={session.firm.address} />
              <Field label="GSTIN" name="gstin" defaultValue={session.firm.gstin} />
              <Field label="PAN" name="pan" defaultValue={session.firm.pan} />
              <Field label="Phone" name="phone" defaultValue={session.firm.phone} />
              <SelectField label="Default SAC" name="sac_code" defaultValue={session.firm.sac_code}>
                {SAC_CODES.map((sac) => <option key={sac.code} value={sac.code}>{sac.label}</option>)}
              </SelectField>
              <Submit>Save firm</Submit>
            </ActionForm>
          ) : <p className="mt-2 text-sm">{session.firm.name}</p>}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">People</h2>
          <ul className="mt-2 text-sm">
            {(staff.data ?? []).map((person) => <li key={person.id}>{person.full_name} · {person.role} · {person.email}</li>)}
          </ul>
          <ul className="mt-2 text-sm text-muted-foreground">
            {(invites.data ?? []).map((invite) => <li key={invite.token}>Invite {invite.email} as {invite.role}: {origin}/join/{invite.token}</li>)}
          </ul>
          {canManage ? (
            <ActionForm action={inviteStaff} className="mt-3">
              <Field label="Email" name="email" type="email" required />
              <SelectField label="Role" name="role" defaultValue="staff">
                <option value="partner">Partner</option>
                <option value="staff">Staff</option>
                <option value="readonly">Read-only</option>
              </SelectField>
              <Submit>Create invite</Submit>
            </ActionForm>
          ) : null}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Subscription</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Status {session.firm.subscription_status}. Flat monthly firm pricing (all seats included). Razorpay runs in test mode when keys are present.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {Object.values(PLANS).map((item) => {
              const perSeat = item.priceInr === 0 ? 0 : Math.round(item.priceInr / item.seats);
              return (
                <li key={item.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium">
                    {item.name} · {item.priceInr === 0 ? "Free forever" : `${formatInr(item.priceInr, 0)} / month flat`}
                  </p>
                  <p className="text-muted-foreground">
                    {item.seats} seats ({item.priceInr === 0 ? "₹0/seat" : `~${formatInr(perSeat, 0)}/seat`}) · {item.clients.toLocaleString("en-IN")} clients
                  </p>
                  {session.profile.role === "owner" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.priceInr === 0 ? (
                        <ActionForm action={startSubscription}>
                          <input type="hidden" name="plan" value={item.id} />
                          <Submit>Switch to Free plan</Submit>
                        </ActionForm>
                      ) : (
                        <>
                          <ActionForm action={startSubscription}>
                            <input type="hidden" name="plan" value={item.id} />
                            <Submit>Razorpay test checkout</Submit>
                          </ActionForm>
                          <ActionForm action={activateLocalPlan}>
                            <input type="hidden" name="plan" value={item.id} />
                            <Submit>Activate locally</Submit>
                          </ActionForm>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Pipeline stages</h2>
          {(stages.data ?? []).map((stage) => (
            <ActionForm key={stage.id} action={renameStage} className="mt-2 grid grid-cols-[1fr_5rem_auto] items-end gap-2">
              <input type="hidden" name="id" value={stage.id} />
              <Field label={stage.name} name="name" defaultValue={stage.name} />
              <Field label="%" name="probability" type="number" defaultValue={stage.probability} />
              <Submit>Save</Submit>
            </ActionForm>
          ))}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Custom fields</h2>
          <ul className="mt-2 text-sm">{(fields.data ?? []).map((field) => <li key={field.id}>{field.module} · {field.label}</li>)}</ul>
          {plan.customFields ? (
            <ActionForm action={createField} className="mt-3">
              <Field label="Label" name="label" required />
              <SelectField label="Module" name="module" defaultValue="lead">
                <option value="lead">Lead</option>
                <option value="contact">Contact</option>
                <option value="account">Client</option>
                <option value="deal">Deal</option>
              </SelectField>
              <SelectField label="Type" name="field_type" defaultValue="text">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select</option>
                <option value="boolean">Yes / no</option>
              </SelectField>
              <Field label="Options, comma separated" name="options" />
              <Submit>Add field</Submit>
            </ActionForm>
          ) : <p className="mt-2 text-sm text-muted-foreground">Custom fields need Growth.</p>}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Workflows</h2>
          <ul className="mt-2 text-sm">
            {(workflows.data ?? []).map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-2 py-1">
                <span>{rule.name} · {rule.trigger_event}</span>
                <form action={toggleWorkflow}>
                  <input type="hidden" name="id" value={rule.id} />
                  <input type="hidden" name="active" value={rule.active ? "" : "on"} />
                  <button className="underline" type="submit">{rule.active ? "Pause" : "Resume"}</button>
                </form>
              </li>
            ))}
          </ul>
          {plan.workflows ? (
            <ActionForm action={createWorkflow} className="mt-3">
              <Field label="Name" name="name" required />
              <SelectField label="When" name="trigger_event" defaultValue="lead.created">
                <option value="lead.created">A lead is created</option>
                <option value="deal.stage_changed">A deal changes stage</option>
              </SelectField>
              <SelectField label="Staff" name="user_id" defaultValue={session.profile.id}>
                {(staff.data ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
              </SelectField>
              <Field label="Task subject" name="task_subject" defaultValue="Call new lead within a day" />
              <Submit>Add rule</Submit>
            </ActionForm>
          ) : <p className="mt-2 text-sm">Workflows need Growth.</p>}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Message templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sending is stubbed. WhatsApp links on a client file use wa.me now.</p>
          <ul className="mt-2 text-sm">{(templates.data ?? []).map((template) => <li key={template.id}>{template.channel} · {template.name}</li>)}</ul>
          <ActionForm action={createTemplate} className="mt-3">
            <Field label="Name" name="name" required />
            <SelectField label="Channel" name="channel" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </SelectField>
            <Field label="Subject" name="subject" />
            <TextAreaField label="Body" name="body" defaultValue="Hello {{name}}, {{filing}} is due on {{due_date}}. — {{firm_name}}" />
            <Submit>Save template</Submit>
          </ActionForm>
          <ul className="mt-3 text-xs text-muted-foreground">
            {(messages.data ?? []).map((message) => <li key={message.created_at + message.recipient}>{message.status} {message.channel} to {message.recipient}</li>)}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Web-to-lead</h2>
          {(forms.data ?? []).map((form) => (
            <div key={form.public_key} className="mt-2 text-sm">
              <p>{form.name}</p>
              <p className="break-all text-muted-foreground">{origin}/f/{form.public_key}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 text-xs">{`<iframe src="${origin}/f/${form.public_key}" title="Enquiry" style="width:100%;height:640px;border:0"></iframe>`}</pre>
            </div>
          ))}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Due-date override</h2>
          <p className="mt-1 text-sm text-muted-foreground">Copies a system rule onto the firm and sets every period&apos;s due day. Generate the year again afterwards.</p>
          {session.profile.role === "owner" ? (
            <ActionForm action={overrideDueDay} className="mt-3">
              <SelectField label="Rule" name="rule" defaultValue="GSTR1|monthly">
                {SYSTEM_RULES.map((rule) => (
                  <option key={rule.code + rule.variant} value={`${rule.code}|${rule.variant}`}>
                    {rule.name} · {rule.variant}
                  </option>
                ))}
              </SelectField>
              <Field label="Due day" name="due_day" type="number" defaultValue={11} />
              <Submit>Save override</Submit>
            </ActionForm>
          ) : <p className="mt-2 text-sm">Only the owner edits due dates.</p>}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">AI Copilot</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {aiStatus.enabled ? "Enabled" : "Disabled"} ·{" "}
            <span className="tabular-nums">
              {aiStatus.usedToday} / {aiStatus.dailyQuota}
            </span>{" "}
            requests today ({plan.name} plan) · Model {aiStatus.model}
          </p>
          {!aiStatus.schemaReady ? (
            <p className="mt-2 text-xs text-destructive">
              AI database tables are missing. Apply the latest Supabase migration before enabling AI Copilot.
            </p>
          ) : aiStatus.statusError ? (
            <p className="mt-2 text-xs text-destructive">
              Could not verify AI Copilot status or usage: {aiStatus.statusError}
            </p>
          ) : null}
          {!aiStatus.providerConfigured ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Server AI provider key is not configured yet. Features stay unavailable until GEMINI_API_KEY is set on the Worker.
            </p>
          ) : null}
          <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            {AI_EXTERNAL_NOTICE}
          </p>
          {canManageAi ? (
            <ActionForm action={updateAiSettings} className="mt-3">
              <CheckField label="Enable AI Copilot for firm staff" name="enabled" defaultChecked={aiStatus.enabled} />
              <CheckField
                label="I confirm this firm has reviewed and accepts the external AI provider notice above"
                name="notice_accepted"
                defaultChecked={Boolean(aiStatus.noticeAcceptedAt)}
              />
              <Submit>Save AI setting</Submit>
            </ActionForm>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Only a partner or the firm owner changes AI Copilot settings.</p>
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Audit log</h2>
            <a className="text-sm underline" href="/api/firm/export">Export firm data</a>
          </div>
          <ul className="mt-2 text-sm">
            {(audits.data ?? []).map((row, index) => (
              <li key={index}>{formatDateTime(row.created_at)} · {row.action} {row.entity_type}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
