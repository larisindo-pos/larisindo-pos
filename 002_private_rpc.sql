
begin;
do $block$ declare f record;args text;signature text;cmd text;begin
for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as ids,pg_get_function_arguments(p.oid) as args,pg_get_function_result(p.oid) as result,p.pronargs from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'pos_%' loop
select string_agg('$'||g,',') into args from generate_series(1,f.pronargs)g;
execute format('alter function public.%I(%s) set schema private',f.proname,f.ids);
execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',f.proname,f.args,f.result,'select private.'||f.proname||'('||coalesce(args,'')||')');
execute format('revoke all on function public.%I(%s) from public,anon',f.proname,f.ids);
execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.ids);
end loop;end $block$;
grant usage on schema private to authenticated;
-- Grant only checked application entry points; internal helpers remain private.
do $$ declare f record;begin for f in select p.proname,pg_get_function_identity_arguments(p.oid) ids from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'pos_%' loop execute format('grant execute on function private.%I(%s) to authenticated',f.proname,f.ids);end loop;end $$;
commit;
