import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'

export async function database() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE PUBLICATION supabase_realtime;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`)
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(new URL(file, dir), 'utf8')) }
    catch (error) { await db.close(); throw new Error(`Migration ${file}: ${error.message}`) }
  }
  return db
}

export async function asUser(db, id, sql, params = []) {
  return db.transaction(async tx => {
    await tx.exec('SET LOCAL ROLE authenticated')
    await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id])
    return tx.query(sql, params)
  })
}
export async function room(db, count = 2, privateRoom = false, password = null) {
  const users = Array.from({ length: count }, () => crypto.randomUUID())
  const created = (await asUser(db, users[0], 'SELECT create_room($1,$2,$3) AS r', ['Host', privateRoom, password])).rows[0].r
  const players = [created.player_id]
  for (let i = 1; i < count; i++) {
    const joined = (await asUser(db, users[i], 'SELECT join_room($1::text,$2::text,$3::text) AS r', [created.room_code, `Player ${i}`, password])).rows[0].r
    if (joined.error) throw new Error(joined.error)
    players.push(joined.player_id)
  }
  return { id: created.room_id, code: created.room_code, players, users }
}
