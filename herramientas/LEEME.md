# Verificación sin conexión a Prisma

`generar-tipos-prisma.py` deriva los tipos de `@prisma/client` leyendo
`prisma/schema.prisma`. Sirve para correr `npx tsc --noEmit` y `npx next build`
en entornos donde no se pueden descargar los binarios de Prisma.

No reemplaza al cliente real: en tu máquina y en Vercel, `npm install` genera el
cliente verdadero y estos tipos quedan pisados. Es solo una red de seguridad para
que un chequeo de tipos no pase en falso.

    python3 herramientas/generar-tipos-prisma.py
    npx tsc --noEmit
