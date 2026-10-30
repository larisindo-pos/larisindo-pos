begin;
do $$
declare owner_id uuid;
begin
 if exists(select 1 from auth.users where lower(email)='appkasir.larisindo@gmail.com') then raise exception 'Email baru sudah digunakan akun lain';end if;
 select u.id into strict owner_id from auth.users u join public.app_users a on a.id=u.id where lower(u.email)='appkasir.jalancahaya@gmail.com' and a.role='Super Admin' and a.active for update of u,a;
 update auth.users set email='appkasir.larisindo@gmail.com', raw_user_meta_data=case when coalesce(raw_user_meta_data,'{}'::jsonb) ? 'email' then jsonb_set(raw_user_meta_data,'{email}',to_jsonb('appkasir.larisindo@gmail.com'::text)) else raw_user_meta_data end, updated_at=now() where id=owner_id;
 update auth.identities set identity_data=jsonb_set(identity_data,'{email}',to_jsonb('appkasir.larisindo@gmail.com'::text)),updated_at=now() where user_id=owner_id and provider='email';
 update public.app_users set email='appkasir.larisindo@gmail.com' where id=owner_id;
 insert into public.audit_log(actor_id,action,detail) values(owner_id,'owner_email_changed',jsonb_build_object('previous_email','appkasir.jalancahaya@gmail.com','new_email','appkasir.larisindo@gmail.com','reason','Requested by owner'));
end $$;
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.app_users(id,email,name,role,active) values(new.id,lower(new.email),split_part(new.email,'@',1),case when lower(new.email)='appkasir.larisindo@gmail.com' then 'Super Admin' else 'Kasir' end,lower(new.email)='appkasir.larisindo@gmail.com');return new;end $$;
revoke all on function private.on_signup() from public,anon,authenticated;
commit;
