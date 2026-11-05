import fs from 'fs';
import {deAppAtual,normalizarBackup} from '../../base/importar.mjs';
import * as C from '../../base/calculo.mjs';
const d=JSON.parse(fs.readFileSync(new URL('./dif-app.json',import.meta.url),'utf8'));
const {estado,resumo}=deAppAtual(normalizarBackup(d.backup).backup,d.o.hoje);
console.log(JSON.stringify(resumo));
const ym="2026-11",B={
 naConta:C.naConta(estado),fimDoMes:C.fimDoMes(estado,ym),fimDez:C.fimDoMes(estado,"2026-12"),
 "Inter.11":C.fatura(estado,"Inter",ym).total,"Inter.12":C.fatura(estado,"Inter","2026-12").total,"Inter.10":C.fatura(estado,"Inter","2026-10").total,
 "Pan.11":C.fatura(estado,"Pan",ym).total,"Pan.12":C.fatura(estado,"Pan","2026-12").total,"Pan.10":C.fatura(estado,"Pan","2026-10").total,
 liveInter:C.limite(estado,"Inter")?.livre,livePan:C.limite(estado,"Pan")?.livre,gastou:C.gastou(estado,ym),entrou:C.entrou(estado,ym)};
const A=d.o;const rows=[
 ["Na conta hoje",A.accBal,B.naConta],["Fim do mês (nov)",A.endBal,B.fimDoMes],["Fim de dez",A.endBalDez,B.fimDez],
 ["Fatura Inter nov",A["billShow.Inter.11"],B["Inter.11"]],["Fatura Inter dez",A["billShow.Inter.12"],B["Inter.12"]],["Fatura Inter out",A["billShow.Inter.10"],B["Inter.10"]],
 ["Fatura Pan nov",A["billShow.Pan.11"],B["Pan.11"]],["Fatura Pan dez",A["billShow.Pan.12"],B["Pan.12"]],["Fatura Pan out",A["billShow.Pan.10"],B["Pan.10"]],
 ["Livre Inter",A["free.Inter"].free,B.liveInter],["Livre Pan",A["free.Pan"].free,B.livePan],["Gastou nov",A.gastouApp,B.gastou],["Entrou nov",A.entrouApp,B.entrou]];
for(const [n,a,b] of rows)console.log((a===b?"OK  ":"DIFF")+" "+n.padEnd(20)+" app="+a+"  base="+b);
