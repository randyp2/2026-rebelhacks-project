-- Replace seeded placeholder names with deterministic real names.
-- Scope is intentionally narrow: only rows matching "Mock Guest %".
with target_people as (
  select id, row_number() over (order by id) as rn
  from public.persons
  where full_name like 'Mock Guest %'
),
first_names as (
  select row_number() over () as idx, name
  from (
    values
      ('Liam'),
      ('Olivia'),
      ('Noah'),
      ('Emma'),
      ('Elijah'),
      ('Ava'),
      ('Mateo'),
      ('Sophia'),
      ('Lucas'),
      ('Isabella'),
      ('Mason'),
      ('Mia'),
      ('Ethan'),
      ('Amelia'),
      ('Logan'),
      ('Harper'),
      ('James'),
      ('Evelyn'),
      ('Aiden'),
      ('Abigail'),
      ('Benjamin'),
      ('Emily'),
      ('Jackson'),
      ('Ella'),
      ('Jacob'),
      ('Elizabeth'),
      ('Michael'),
      ('Sofia'),
      ('Levi'),
      ('Avery'),
      ('Sebastian'),
      ('Scarlett'),
      ('Jack'),
      ('Madison'),
      ('Owen'),
      ('Luna'),
      ('Theodore'),
      ('Grace'),
      ('Henry'),
      ('Chloe')
  ) as names(name)
),
last_names as (
  select row_number() over () as idx, name
  from (
    values
      ('Anderson'),
      ('Bennett'),
      ('Brooks'),
      ('Campbell'),
      ('Carter'),
      ('Collins'),
      ('Cooper'),
      ('Cruz'),
      ('Diaz'),
      ('Edwards'),
      ('Evans'),
      ('Foster'),
      ('Garcia'),
      ('Gonzalez'),
      ('Gray'),
      ('Green'),
      ('Hall'),
      ('Harris'),
      ('Hayes'),
      ('Hughes'),
      ('Jackson'),
      ('Johnson'),
      ('Kelly'),
      ('King'),
      ('Lee'),
      ('Lewis'),
      ('Long'),
      ('Martinez'),
      ('Miller'),
      ('Mitchell'),
      ('Morgan'),
      ('Morris'),
      ('Nguyen'),
      ('Parker'),
      ('Perez'),
      ('Reed'),
      ('Rivera'),
      ('Roberts'),
      ('Scott'),
      ('Turner')
  ) as names(name)
),
counts as (
  select
    (select count(*) from first_names) as first_count,
    (select count(*) from last_names) as last_count
),
replacement_names as (
  select
    tp.id,
    fn.name
      || ' '
      || ln.name
      || case
        when tp.rn > (c.first_count * c.last_count)
          then ' ' || (((tp.rn - 1) / (c.first_count * c.last_count)) + 1)::text
        else ''
      end as full_name
  from target_people tp
  cross join counts c
  join first_names fn on fn.idx = ((tp.rn - 1) % c.first_count) + 1
  join last_names ln on ln.idx = (((tp.rn - 1) / c.first_count) % c.last_count) + 1
)
update public.persons p
set full_name = rn.full_name
from replacement_names rn
where p.id = rn.id;
