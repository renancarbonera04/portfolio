// Carrega o NÚCLEO (funções puras) direto do Boletos-a-cobrar-v2.html, entre os marcadores,
// num contexto isolado do Node. Assim os testes rodam sobre o arquivo entregue de verdade.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
export function carregarNucleo(html = process.env.HTML || path.join(aqui, '..', 'Boletos-a-cobrar-v2.html')) {
  let codigo;
  if (html.endsWith('.js')) codigo = fs.readFileSync(html, 'utf8');
  else {
    const t = fs.readFileSync(html, 'utf8');
    const a = t.indexOf('/*<NUCLEO>*/'), b = t.indexOf('/*</NUCLEO>*/');
    if (a < 0 || b < 0) throw new Error('marcadores do núcleo não encontrados em ' + html);
    codigo = t.slice(a, b);
  }
  // Roda no mesmo "realm" do Node (objetos comparáveis com assert.deepEqual)
  vm.runInThisContext(codigo, { filename: 'nucleo.js' });
  return new Proxy({}, { get: (_, nome) => typeof nome === 'string' ? vm.runInThisContext(nome) : undefined });
}
