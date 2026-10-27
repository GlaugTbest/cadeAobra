import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  email = process.env.ADMIN_EMAIL;
if (!url || !key || !email)
  throw Error(
    "Configure URL, chave de serviço e ADMIN_EMAIL em ambiente privado.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
  redirectTo:
    (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") + "/admin",
});
if (error) throw error;
console.log(
  "Convite enviado. Execute no SQL Editor, com papel postgres, para autorizar o administrador:",
);
console.log(
  `insert into private.administrators(user_id) values ('${data.user.id}') on conflict do nothing;`,
);
console.log(
  "Não é possível criar administradores por autocadastro ou metadados do usuário.",
);
