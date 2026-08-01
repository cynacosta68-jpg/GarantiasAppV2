/**
 * Alta de cuentas desde la línea de comandos.
 *   npm run usuario -- ana@empresa.com "Ana Pérez" claveSegura1 admin
 * Si el correo ya existe, se actualiza la contraseña y el rol.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const [email, nombre, password, rol = 'operador'] = process.argv.slice(2);

if (!email || !nombre || !password) {
  console.error('Uso: npm run usuario -- <email> "<nombre>" <password> [admin|operador]');
  process.exit(1);
}
if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error('La contraseña necesita al menos 8 caracteres, una letra y un número.');
  process.exit(1);
}

const sal = randomBytes(16);
const passwordHash = `scrypt$${sal.toString('hex')}$${scryptSync(password, sal, 64).toString('hex')}`;

const prisma = new PrismaClient();
const datos = { nombre, rol, passwordHash, activo: true };

const usuario = await prisma.usuario.upsert({
  where: { email: email.trim().toLowerCase() },
  create: { email: email.trim().toLowerCase(), ...datos },
  update: datos,
});

console.log(`Cuenta lista: ${usuario.email} (${usuario.rol})`);
await prisma.$disconnect();
