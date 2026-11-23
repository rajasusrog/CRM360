-- API entry points live with CRM data; internal helpers are never exposed.
revoke execute on all functions in schema crmpro_private from public, anon;
grant usage on schema crmpro_private to authenticated, service_role;

create function crmpro.crmpro_create_firm(p_name text, p_city text, p_state_code text, p_gstin text, p_phone text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.create_firm(p_name, p_city, p_state_code, p_gstin, p_phone) $$;
create function crmpro.crmpro_accept_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.accept_invite(p_token) $$;
create function crmpro.crmpro_accept_portal_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.accept_portal_invite(p_token) $$;
revoke execute on all functions in schema crmpro from public, anon;
grant execute on all functions in schema crmpro to authenticated, service_role;

-- Only the owner can manage staff invitations. Portal invites are for managers.
create policy invitations_manager on crmpro.invitations for all to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner')
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner');
create policy portal_invites_manager on crmpro.portal_invites for all to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner','partner'))
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner','partner'));

drop policy profiles_update_managers on crmpro.profiles;
create policy profiles_update_managers on crmpro.profiles for update to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner' and id <> auth.uid())
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner' and id <> auth.uid() and role in ('partner','staff','readonly'));

-- Restrict storage replacement both before and after an update.
drop policy crmpro_documents_storage_update on storage.objects;
create policy crmpro_documents_storage_update on storage.objects for update to authenticated
using (bucket_id = 'crmpro_documents' and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write())
with check (bucket_id = 'crmpro_documents' and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write());

-- Relationships must stay within a tenant even when a user knows another UUID.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='crmpro' and c.relkind='r'
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='firm_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='id' and not a.attisdropped)
  loop
    execute format('alter table crmpro.%I add constraint %I unique (firm_id,id)',r.relname,'crmpro_'||r.relname||'_firm_id_id_key');
  end loop;
  for r in
    select child.relname child_table, parent.relname parent_table, ca.attname child_column, fk.oid
    from pg_constraint fk
    join pg_class child on child.oid=fk.conrelid
    join pg_namespace cn on cn.oid=child.relnamespace
    join pg_class parent on parent.oid=fk.confrelid
    join pg_namespace pn on pn.oid=parent.relnamespace
    join pg_attribute ca on ca.attrelid=child.oid and ca.attnum=fk.conkey[1]
    join pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=fk.confkey[1]
    where fk.contype='f' and array_length(fk.conkey,1)=1 and pa.attname='id'
      and cn.nspname='crmpro' and pn.nspname='crmpro' and ca.attname <> 'firm_id'
      and exists (select 1 from pg_attribute a where a.attrelid=child.oid and a.attname='firm_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid=parent.oid and a.attname='firm_id' and not a.attisdropped)
  loop
    execute format('alter table crmpro.%I add constraint %I foreign key (firm_id,%I) references crmpro.%I (firm_id,id)',
      r.child_table,'crmpro_tenant_fk_'||r.oid,r.child_column,r.parent_table);
  end loop;
end $$;

-- New namespace only; do not change grants on any existing application's tables.
revoke all on all tables in schema crmpro from anon;

-- Existing permissive storage policies are OR-ed. These restrictive gates
-- protect only the new bucket and evaluate true for every other bucket.
create policy crmpro_storage_gate_read on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'crmpro_documents' or (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text);
create policy crmpro_storage_gate_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_update on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()))
with check (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_anon on storage.objects as restrictive for all to anon
using (bucket_id <> 'crmpro_documents') with check (bucket_id <> 'crmpro_documents');
notify pgrst, 'reload schema';
