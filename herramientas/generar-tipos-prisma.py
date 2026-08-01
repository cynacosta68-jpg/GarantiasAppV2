"""Genera tipos de @prisma/client a partir de schema.prisma.
No reemplaza al cliente real, pero sí reproduce las formas que Prisma exige:
Create/Update/Where inputs, JSON, Decimal y los delegados tipados."""
import re, pathlib

esquema = pathlib.Path('prisma/schema.prisma').read_text()
modelos = {}
for m in re.finditer(r'model\s+(\w+)\s*\{(.*?)\n\}', esquema, re.S):
    nombre, cuerpo = m.group(1), m.group(2)
    campos = []
    for linea in cuerpo.splitlines():
        linea = linea.split('//')[0].strip()
        if not linea or linea.startswith('@@'):
            continue
        partes = linea.split()
        if len(partes) < 2:
            continue
        campo, tipo = partes[0], partes[1]
        opcional = tipo.endswith('?')
        lista = tipo.endswith('[]')
        base = tipo.rstrip('?[]')
        tiene_default = '@default' in linea or '@updatedAt' in linea
        campos.append((campo, base, opcional, lista, tiene_default))
    modelos[nombre] = campos

TS = {
    'String': 'string', 'Int': 'number', 'Float': 'number', 'Boolean': 'boolean',
    'DateTime': 'Date', 'Decimal': 'Decimal', 'Json': 'InputJsonValue', 'BigInt': 'bigint',
}

def ts_lectura(base):
    if base in TS:
        return 'Decimal' if base == 'Decimal' else ('JsonValue' if base == 'Json' else TS[base])
    return 'any'

out = ['// Generado desde prisma/schema.prisma para verificacion de tipos.', '']
out.append('export declare class Decimal { constructor(v: any); toNumber(): number; toString(): string; }')
out.append('''
export declare namespace Prisma {
  type JsonObject = { [k: string]: InputJsonValue | null };
  type JsonArray = ReadonlyArray<InputJsonValue | null>;
  type InputJsonValue = string | number | boolean | JsonObject | JsonArray;
  type JsonValue = InputJsonValue | null;
  const JsonNull: unique symbol;
  const DbNull: unique symbol;
  const AnyNull: unique symbol;
  type StringFilter = string | { contains?: string; in?: string[]; not?: any; mode?: 'insensitive' | 'default'; equals?: string };
  type DateFilter = Date | { gte?: Date; lte?: Date; gt?: Date; lt?: Date; equals?: Date | null };
  type NumFilter = number | { gte?: number; lte?: number; equals?: number };
''')

for nombre, campos in modelos.items():
    # Tipo de lectura (lo que devuelven las consultas)
    lectura = [f'    {c}{"?" if False else ""}: {ts_lectura(b)}{" | null" if o else ""};'
               for c, b, o, l, d in campos if not l and b not in modelos]
    out.append(f'  type {nombre}Payload = {{\n' + '\n'.join(lectura) + '\n  };')

    # Create: obligatorio salvo opcional o con @default
    crea = []
    for c, b, o, l, d in campos:
        if l or b in modelos:
            continue
        t = 'InputJsonValue' if b == 'Json' else ('number | Decimal' if b == 'Decimal' else TS.get(b, 'any'))
        crea.append(f'    {c}{"?" if (o or d) else ""}: {t}{" | null" if o else ""};')
    crea.append('    cargaId?: string | null;')
    out.append(f'  type {nombre}CreateInput = {{\n' + '\n'.join(crea) + '\n  };')

    # Update: todo opcional
    act = []
    for c, b, o, l, d in campos:
        if l or b in modelos:
            continue
        t = 'InputJsonValue' if b == 'Json' else ('number | Decimal' if b == 'Decimal' else TS.get(b, 'any'))
        act.append(f'    {c}?: {t}{" | null" if o else ""};')
    act.append('    cargaId?: string | null;')
    out.append(f'  type {nombre}UpdateInput = {{\n' + '\n'.join(act) + '\n  };')

    # Where
    wh = []
    for c, b, o, l, d in campos:
        if l or b in modelos:
            continue
        if b == 'String':
            wh.append(f'    {c}?: StringFilter | null;')
        elif b == 'DateTime':
            wh.append(f'    {c}?: DateFilter | null;')
        elif b in ('Int', 'Float', 'Decimal'):
            wh.append(f'    {c}?: NumFilter;')
        else:
            wh.append(f'    {c}?: any;')
    wh.append('    OR?: any[]; AND?: any[]; NOT?: any;')
    out.append(f'  type {nombre}WhereInput = {{\n' + '\n'.join(wh) + '\n  };')

out.append('}')

# Delegados
delegados = []
for nombre in modelos:
    n = nombre[0].lower() + nombre[1:]
    delegados.append(f'''  {n}: {{
    findMany(a?: {{ where?: Prisma.{nombre}WhereInput; select?: any; include?: any; orderBy?: any; skip?: number; take?: number; distinct?: any }}): Promise<any[]>;
    findUnique(a: {{ where: any; select?: any; include?: any }}): Promise<any>;
    create(a: {{ data: Prisma.{nombre}CreateInput; select?: any }}): Promise<any>;
    createMany(a: {{ data: Prisma.{nombre}CreateInput[]; skipDuplicates?: boolean }}): Promise<{{ count: number }}>;
    updateMany(a: {{ where?: Prisma.{nombre}WhereInput; data: Prisma.{nombre}UpdateInput }}): Promise<{{ count: number }}>;
    update(a: {{ where: any; data: Prisma.{nombre}UpdateInput; select?: any }}): Promise<any>;
    upsert(a: {{ where: any; create: Prisma.{nombre}CreateInput; update: Prisma.{nombre}UpdateInput }}): Promise<any>;
    delete(a: {{ where: any }}): Promise<any>;
    deleteMany(a?: {{ where?: any }}): Promise<{{ count: number }}>;
    count(a?: {{ where?: Prisma.{nombre}WhereInput }}): Promise<number>;
    aggregate(a: {{ where?: Prisma.{nombre}WhereInput; _sum?: any; _count?: any }}): Promise<any>;
    groupBy(a: {{ by: any; where?: Prisma.{nombre}WhereInput; _count?: any; _sum?: any; orderBy?: any; take?: number }}): Promise<any[]>;
    createMany(a: {{ data: Prisma.{nombre}CreateInput[]; skipDuplicates?: boolean }}): Promise<{{ count: number }}>;
  }};''')

out.append('export declare class PrismaClient {\n  constructor(opts?: any);\n' + '\n'.join(delegados) + '''
  $transaction(operaciones: any[]): Promise<any[]>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}''')

destino = pathlib.Path('node_modules/@prisma/client')
destino.mkdir(parents=True, exist_ok=True)
(destino / 'index.d.ts').write_text('\n'.join(out))
(destino / 'package.json').write_text('{"name":"@prisma/client","version":"0.0.0","types":"index.d.ts","main":"index.js"}')
(destino / 'index.js').write_text('module.exports={};')
print('modelos detectados:', ', '.join(modelos))
print('tipos generados:', len(out), 'bloques')
