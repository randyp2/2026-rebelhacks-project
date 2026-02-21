delete from public.connector_mappings
where connector_id in (
  select id from public.connectors where system = 'wifi'
);

delete from public.connectors
where system = 'wifi';

alter table public.connectors
drop constraint if exists connectors_system_check;

alter table public.connectors
add constraint connectors_system_check
check (system in ('pms', 'housekeeping'));

