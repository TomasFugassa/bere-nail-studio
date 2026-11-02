import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
const directory = path.resolve(process.env.DEMO_DATA_DIR || '.demo-data');
mkdirSync(path.join(directory, 'backups'), { recursive: true });
const filename = path.join(
  directory,
  'backups',
  new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
);
const database = new DatabaseSync(path.join(directory, 'demo.sqlite'), { readOnly: true });
database.exec("VACUUM INTO '" + filename.replaceAll("'", "''") + "'");
database.close();
chmodSync(filename, 0o600);
console.log('Copia privada creada: ' + filename);
