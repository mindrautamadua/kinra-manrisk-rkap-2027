// Membuat/mengganti password pengguna aplikasi. Mencetak SQL untuk dijalankan di Supabase SQL Editor.
// Pemakaian: node scripts/buat-user.mjs <username> "<Nama Lengkap>"
// Password diminta interaktif (tidak tersimpan di riwayat shell).
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const [username, nama = ""] = process.argv.slice(2);
if (!username) { console.error('Pemakaian: node scripts/buat-user.mjs <username> "<Nama Lengkap>"'); process.exit(1); }

function ask(q) {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.startsWith(q)) rl.output.write(q); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); ok(a); });
  });
}

const pw = await ask("Password (min. 10 karakter): ");
if (pw.length < 10) { console.error("Password terlalu pendek."); process.exit(1); }
if (pw !== await ask("Ulangi password: ")) { console.error("Password tidak sama."); process.exit(1); }

const salt = randomBytes(16);
const key = await new Promise((ok, fail) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))));
const hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
const q = (s) => `'${s.replace(/'/g, "''")}'`;

console.log(`\ninsert into app_user (username, nama, password_hash) values (${q(username.trim().toLowerCase())}, ${q(nama)}, ${q(hash)})
on conflict (username) do update set nama = excluded.nama, password_hash = excluded.password_hash, gagal_login = 0, terkunci_sampai = null, aktif = true;`);
