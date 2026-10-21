// Leitores de PDF: fatura (Inter, Pan, PicPay, Renner/Realize), conta/boleto e holerite.
// Código calibrado com PDFs reais e movido do app antigo SEM mexer na lógica (por isso @ts-nocheck: não "arrumar" a tipagem aqui
// sem um PDF de exemplo para conferir). Cada layout novo precisa de um PDF de exemplo; ver CLAUDE.md.
// @ts-nocheck
import { fold, lastDay, shiftYM, today } from "../format";

export type PdfItem = { s: string; x: number; w: number; t: number };
export type PdfPage = { h: number; w: number; items: PdfItem[] };

export function parseInvoice(pages){
  const MONEY=/^-?\d{1,3}(\.\d{3})*,\d{2}$/, DATE=/^\d{2}\/\d{2}\/\d{4}$/;
  const toC=v=>{const neg=v.startsWith("-");return (neg?-1:1)*Number(v.replace(/[-.]/g,"").replace(",",""))};
  const iso=d=>{const[a,b,c]=d.split("/");return `${c}-${b}-${a}`};
  const all=pages.map(p=>p.items.map(i=>i.s).join(" ")).join(" \n ").replace(/\s+/g," ");
  if(/Banco Inter|bancointer|inter\.co\//i.test(all)) return parseInter(pages,all);
  if(/Banco Pan\b|bancopan/i.test(all)) return parsePan(pages,all);
  /* PicPay: "Fechamento: dd/mm/aaaa" com ano; a Renner/Realize também cita PicPay (onde pagar) e tem "Próximo Fechamento dd/mm" */
  if(/PicPay/i.test(all)&&!/Realize/i.test(all)&&/Fechamento:?\s*\d{2}\/\d{2}\/\d{4}/i.test(all)&&/Estabelecimento/i.test(all)) return parsePicPay(pages);
  const bank=/Realize|Renner/i.test(all)?"Renner":"";
  const dueM=/Vencimento:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(all);
  const due=dueM?iso(dueM[1]):"";
  const rows=[];let inSec=false,cols=null;
  for(const pg of pages){
    const it=[...pg.items].filter(i=>i.s.trim()).sort((a,b)=>a.t-b.t||a.x-b.x);
    let start=-1,end=Infinity;
    for(const i of it){
      if(start<0&&/Lançamentos detalhados|Lançamentos do período|Lançamentos:/i.test(i.s)) start=i.t;
      if(/Compras parceladas|Próximas Faturas|Total para as próximas/i.test(i.s)&&(start>=0||inSec)&&i.t>(start<0?-1:start)) {end=Math.min(end,i.t);}
    }
    if(start>=0) inSec=true;
    if(!inSec) continue;
    const est=it.find(i=>/^Estabelecimento$/i.test(i.s.trim())&&i.t>=start), val=it.find(i=>/^(Crédito\/|Valor|Débito|Valor \(R\$\))/i.test(i.s.trim())&&i.x>300&&i.t>=start);
    if(est||val) cols={est:est?est.x-25:null,val:val?val.x-20:null};
    const sec=it.filter(i=>i.t>(start<0?-1:start)&&i.t<end);
    const anchors=sec.filter(i=>DATE.test(i.s.trim())&&i.x<60);
    anchors.forEach((a,k)=>{
      const lo=a.t-5, hi=k+1<anchors.length?anchors[k+1].t-5:Math.min(end,a.t+30);
      const blk=sec.filter(i=>i.t>=lo&&i.t<hi&&i!==a);
      const valX=cols&&cols.val||460, estX=cols&&cols.est||300;
      const v=blk.filter(i=>i.x>=valX&&MONEY.test(i.s.trim().replace(/\s/g,""))).pop();
      if(!v) return;
      const desc=blk.filter(i=>i.x<estX&&i.x>=55).map(i=>i.s.trim()).join(" ").replace(/\s+/g," ").trim();
      const shop=blk.filter(i=>i.x>=estX&&i.x<valX).map(i=>i.s.trim()).join(" ").replace(/\s+/g," ").trim();
      rows.push({date:iso(a.s.trim()),desc,shop,cents:toC(v.s.trim().replace(/\s/g,""))});
    });
    if(end<Infinity) inSec=false;
  }
  return {bank,due,rows};
}
/* linhas da página: agrupa itens pela altura e junta pedaços da mesma palavra/frase em células */
export function pdfLines(pg){
  const it=[...pg.items].filter(i=>i.s.trim()).sort((a,b)=>a.t-b.t||a.x-b.x), L=[];
  for(const i of it){const l=L.find(l=>Math.abs(l.t-i.t)<2);if(l)l.items.push(i);else L.push({t:i.t,items:[i]})}
  return L.map(l=>{const cells=[];l.items.sort((a,b)=>a.x-b.x).forEach(i=>{const c=cells[cells.length-1],gap=c?i.x-c.end:99;
    if(c&&gap<6){c.s+=(gap<1.5?"":" ")+i.s;c.end=i.x+(i.w||i.s.length*5)}else cells.push({s:i.s,x:i.x,end:i.x+(i.w||i.s.length*5)})});
    cells.forEach(c=>c.s=c.s.replace(/\s+/g," ").trim());return {t:l.t,cells}});
}
export const moneyC=s=>{const m=/^(\+|-)?\s*R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/.exec(s.trim());if(!m)return null;
  const v=Number(m[3].replace(/\./g,"").replace(",",""));return (m[1]||m[2])?-v:v};
const parcTag=(d,i,n)=>{if(d===d.toUpperCase())d=titleCase(d);return `${d} Parc. ${i}/${n}`};
function parseInter(pages,all){
  const MES={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
  const dm=/Vencimento[^0-9]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i.exec(all), dx=!dm&&/Vencimento[^0-9]{0,40}(\d{1,2}) de ([a-zç]{3})[a-zç]*\.? (?:de )?(\d{4})/i.exec(all);
  const due=dm?`${dm[3]}-${dm[2]}-${dm[1]}`:dx&&MES[dx[2].toLowerCase()]?`${dx[3]}-${String(MES[dx[2].toLowerCase()]).padStart(2,"0")}-${dx[1].padStart(2,"0")}`:"";
  const rows=[];
  for(const pg of pages) for(const ln of pdfLines(pg)){
    const c=ln.cells, d=/^(\d{1,2}) de ([a-zç]{3})\.? (\d{4})$/i.exec(c[0]&&c[0].s||"");
    if(!d||!MES[d[2].toLowerCase()]) continue;
    let k=c.length-1;while(k>0&&moneyC(c[k].s)==null)k--;if(k<1) continue;
    let desc=c.slice(1,k).map(x=>x.s).filter(s=>s!=="-").join(" ");
    const p=/\(Parcela (\d+) de (\d+)\)/i.exec(desc);desc=desc.replace(/\s*\(Parcela \d+ de \d+\)/i,"").trim();
    rows.push({date:`${d[3]}-${String(MES[d[2].toLowerCase()]).padStart(2,"0")}-${d[1].padStart(2,"0")}`,
      desc:p?parcTag(desc,p[1],p[2]):desc,shop:"",cents:moneyC(c[k].s)});
  }
  /* total do banco e o que ficou da fatura anterior (pagamento parcial): o saldo entra como um item, senão a soma não bate */
  let total=null,pend=0;
  for(const pg of pages) for(const ln of pdfLines(pg)){const t=ln.cells.map(c=>c.s).join(" "), v=ln.cells.length>1?moneyC(ln.cells[ln.cells.length-1].s):null;if(v==null)continue;
    if(/^Valor pendente do m[eê]s anterior\b/i.test(t))pend=v;else if(/^Fatura atual\b/i.test(t))total=v}
  if(pend>0) rows.push({date:due?shiftYM(due.slice(0,7),-1)+due.slice(7):rows.length?rows[0].date:today(),desc:"Saldo da fatura anterior",shop:"",cents:pend,prev:true});
  const cm=/Data de corte:?\s*(\d{2})\/\d{2}\/\d{4}/i.exec(all);
  return {bank:"Inter",due,rows,total,close:cm?+cm[1]:0};
}
function parsePan(pages,all){
  const fm=/fechamento desta fatura \((\d{2})\/(\d{2})\/(\d{4})\)/i.exec(all);
  const cm=fm?+fm[2]:12, cy=fm?+fm[3]:new Date().getFullYear();
  let due="";
  pages.some(pg=>{const v=pg.items.find(i=>/^Vencimento$/i.test(i.s.trim()));if(!v)return false;
    const d=pg.items.filter(i=>/^\d{2}\/\d{2}\/\d{4}$/.test(i.s.trim())&&i.t>v.t&&i.t<v.t+30&&Math.abs(i.x-v.x)<40)[0];
    if(d){const[a,b,y]=d.s.trim().split("/");due=`${y}-${b}-${a}`}return !!d});
  const rows=[];let on=false;
  for(const pg of pages){
    const mid=(pg.w||595)/2-5;
    for(const ln of pdfLines(pg)){
      const txt=ln.cells.map(c=>c.s).join(" ");
      if(/Lançamentos do cartão/i.test(txt)){on=true;continue}
      if(/Taxas e encargos/i.test(txt)){on=false;continue}
      if(!on) continue;
      [ln.cells.filter(c=>c.x<mid),ln.cells.filter(c=>c.x>=mid)].forEach(c=>{
        if(!c.length) return;
        const d=/^(\d{2})\/(\d{2})(?:\s+(.*))?$/.exec(c[0].s);if(!d) return;
        let k=c.length-1;while(k>0&&moneyC(c[k].s)==null)k--;if(k<1) return;
        let desc=[d[3]||"",...c.slice(1,k).map(x=>x.s)].join(" ").replace(/\s+/g," ").trim();
        /* parcela: "Parcela 02/03" ou, na anuidade, "04-12" no fim */
        const p=/Parcela (\d+)\/(\d+)/i.exec(desc)||/\s(\d{2})-(\d{2})$/.exec(desc);desc=desc.replace(/\s*Parcela \d+\/\d+/i,"").replace(/\s\d{2}-\d{2}$/,"").trim();
        const m=+d[2], y=m>cm?cy-1:cy;
        rows.push({date:`${y}-${d[2]}-${d[1]}`,desc:p?parcTag(desc,p[1],p[2]):desc,shop:"",cents:moneyC(c[k].s)});
      });
    }
  }
  /* "Resumo das faturas": anterior, pago, lançamentos do mês, total. O que não foi pago da anterior entra como item */
  let total=null;
  for(const pg of pages){const L=pdfLines(pg), k=L.findIndex(l=>l.cells.some(c=>/^Resumo das faturas/i.test(c.s)));if(k<0) continue;
    const v=L.slice(k+1,k+8).map(l=>l.cells.map(c=>moneyC(c.s)).filter(x=>x!=null)).find(a=>a.length>=4);
    if(v){const[ant,pago,,tot]=v;total=tot;const pend=ant-pago;
      if(pend>0) rows.push({date:due?shiftYM(due.slice(0,7),-1)+due.slice(7):today(),desc:"Saldo da fatura anterior",shop:"",cents:pend,prev:true})}
    break}
  return {bank:"Pan",due,rows,total,close:fm?+fm[1]:0};
}
/* PicPay (out/2026, fatura de uma amiga do Camilo): "Vencimento: dd/mm/aaaa | Fechamento: dd/mm/aaaa"; lançamentos em duas
   colunas, "DD/MM  ESTABELECIMENTO  valor" (sem R$; negativo = pagamento/crédito), um bloco por cartão (titular e "final XXXX");
   parcela grudada no nome ("AMAZON MARKETPPARC03/05"). Estorno ("CREDITO …") com o mesmo valor de uma compra cancela a compra;
   "Resumo": Fatura anterior, Pagamento recebido, Créditos, Despesas do mês, Total da fatura. */
function parsePicPay(pages){
  const PL=pages.map(pdfLines), all=PL.map(L=>L.map(l=>l.cells.map(c=>c.s).join("  ")).join("\n")).join("\n");
  const MON=/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/, toC=v=>(v.startsWith("-")?-1:1)*Number(v.replace(/[-.]/g,"").replace(",",""));
  const dm=/Vencimento:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(all), fm=/Fechamento:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(all);
  const due=dm?`${dm[3]}-${dm[2]}-${dm[1]}`:"", cm=fm?+fm[2]:12, cy=fm?+fm[3]:new Date().getFullYear();
  let rows=[];
  pages.forEach((pg,pi)=>{
    const mid=(pg.w||595)/2-5, L=PL[pi];
    /* só páginas com a tabela de lançamentos; a coluna da direita continua a lista e pode vir acima do título */
    if(!L.some(l=>/Transa[çc][õo]es (Nacionais|Internacionais)|^Estabelecimento$/i.test(l.cells.map(c=>c.s).join(" "))||l.cells.some(c=>/^Estabelecimento$/i.test(c.s)))) return;
    let on=true;
    for(const ln of L){
      const txt=ln.cells.map(c=>c.s).join(" ");
      if(/Total parcelado|próximas faturas|Limite dispon[íi]vel para cada/i.test(txt)) on=false;
      if(!on) continue;
      [ln.cells.filter(c=>c.x<mid),ln.cells.filter(c=>c.x>=mid)].forEach(c=>{
        if(c.length<2) return;
        const d=/^(\d{2})\/(\d{2})(?:\s+(.*))?$/.exec(c[0].s);if(!d) return;
        let k=c.length-1;while(k>0&&!MON.test(c[k].s.trim()))k--;if(k<1&&!(d[3]&&MON.test(c[c.length-1].s.trim()))) return;
        let desc=[d[3]||"",...c.slice(1,k).map(x=>x.s)].join(" ").replace(/\s+/g," ").trim();
        const cents=toC(c[k].s.trim());
        if(/^PAGAMENTO( DE)? FATURA|^PAGTO/i.test(desc)) return;
        const pm=/\s*PARC\.?\s?(\d{1,2})\/(\d{1,2})$/i.exec(desc);if(pm) desc=desc.slice(0,pm.index).trim();
        const m=+d[2], y=m>cm?cy-1:cy;
        rows.push({date:`${y}-${d[2]}-${d[1]}`,desc:pm?parcTag(desc,+pm[1],+pm[2]):desc,shop:"",cents});
      });
    }
  });
  /* estorno: crédito que não é parcelamento de fatura cancela a compra de mesmo valor */
  rows.filter(r=>r.cents<0&&!FIN_RE.test(r.desc)).forEach(cr=>{const j=rows.findIndex(x=>x.cents===-cr.cents&&!x.gone);if(j>=0){rows[j].gone=1;cr.gone=1}});
  rows=rows.filter(r=>!r.gone);
  let total=null;const tm=/Total da (?:sua )?fatura\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(all);if(tm) total=toC(tm[1]);
  const ant=/Fatura anterior\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(all), pag=/Pagamento recebido\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(all);
  if(ant&&pag){const pend=toC(ant[1])+toC(pag[1]);if(pend>0) rows.push({date:due?shiftYM(due.slice(0,7),-1)+due.slice(7):today(),desc:"Saldo da fatura anterior",shop:"",cents:pend,prev:true})}
  return {bank:"PicPay",due,rows,total,close:fm?+fm[1]:0};
}
export const titleCase=s=>s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
export const FIN_RE=/\bVL\.?\s?FAT\.?\s?EF\b|PARCELAMENTO DE FATURA|FATURA PARCELADA|\bPARC\.?\s?FAT/i;
export const CONTAS=[["Claro",/Claro S\/?A|minhaclaro|claro\.com\.br/i],["Vivo",/Telef[oô]nica Brasil|\bVivo\b/i],["TIM",/\bTIM S\.?A\b/i],["Oi",/\bOi S\.?A\b/i],
  ["Enel",/\bEnel\b/i],["CPFL",/\bCPFL\b/i],["Elektro",/Elektro/i],["Sabesp",/Sabesp/i],["Comgás",/Comg[aá]s/i]];
export function parseConta(pages){
  const all=pages.map(p=>pdfLines(p).map(l=>l.cells.map(c=>c.s).join(" ")).join(" \n ")).join(" \n ").replace(/[ \t]+/g," ");
  const flat=all.replace(/\s+/g," ").replace(/de \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/gi," ");
  const cnt=(re)=>{const m={};let x;while((x=re.exec(flat)))m[x[1]]=(m[x[1]]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]};
  const dv=cnt(/Vencimento[^0-9]{0,80}?(\d{2}\/\d{2}\/\d{4})/gi);
  const vv=cnt(/(?:Total a pagar|Valor total|Valor a pagar|Valor do documento|Total da fatura)[^0-9]{0,40}?R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/gi);
  if(!dv||!vv) return null;
  const p=CONTAS.find(([,re])=>re.test(flat)), [d,m,y]=dv[0].split("/");
  return {name:p?p[0]:"Conta",due:`${y}-${m}-${d}`,cents:Number(vv[0].replace(/\./g,"").replace(",","")),auto:/D[ée]bito Autom[aá]tico/i.test(flat)};
}
/* holerite (demonstrativo de pagamento): líquido, data do crédito e eventos → uma receita para conferir */
export function parseHolerite(pages){
  const pgs=pages.map(pdfLines).filter(L=>L.some(l=>l.cells.some(c=>/^Valor L[ií]quido|^L[ií]quido a receber/i.test(c.s))));
  if(!pgs.length) return null;
  const L=pgs[0], flat=L.map(l=>l.cells.map(c=>c.s).join(" ")).join(" ");
  if(!/Demonstrativo de Pagamento|Recibo de Pagamento|Holerite|Contracheque|Folha de Pagamento/i.test(flat)) return null;
  const money=s=>/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s)?Number(s.replace(/[.-]/g,"").replace(",","")):null;
  const lab=re=>{for(const l of L){const c=l.cells.find(c=>re.test(c.s));if(c)return {l,c}}return null};
  /* valor logo abaixo do rótulo: célula mais perto na horizontal nas linhas seguintes */
  const below=(re,ok,maxDy=40)=>{const a=lab(re);if(!a)return null;let best=null;
    for(const l of L){const dy=l.t-a.l.t;if(dy<=0||dy>maxDy)continue;
      for(const c of l.cells){if(!ok(c.s))continue;const dx=Math.abs(c.x-a.c.x);if(dx>60)continue;const sc=dy+dx;if(!best||sc<best.sc)best={sc,s:c.s}}}
    return best&&best.s};
  /* líquido: primeiro valor abaixo do rótulo, da coluna dele para a direita */
  let liq=null;{const a=lab(/^Valor L[ií]quido|^L[ií]quido a receber/i);
    if(a){for(const l of L){if(l.t<=a.l.t||l.t-a.l.t>40)continue;const c=l.cells.find(c=>c.x>=a.c.x-5&&money(c.s)!=null);if(c){liq=money(c.s);break}}}}
  const tp=money(below(/^Total de Proventos|^Total de Vencimentos/i,s=>money(s)!=null)||""), td=money(below(/^Total de Descontos/i,s=>money(s)!=null)||"");
  if(liq==null&&tp!=null&&td!=null) liq=tp-td;
  if(!liq||liq<=0) return null;
  const dc=below(/^Data (?:de )?Cr[ée]dito|^Data (?:do )?Pagamento/i,s=>/^\d{2}\/\d{2}\/\d{4}$/.test(s));
  const mr=below(/^M[êe]s(?: de)? Refer[êe]ncia|^Compet[êe]ncia/i,s=>/^\d{1,2}\s*\/\s*\d{4}$/.test(s));
  const emp=below(/^Nome da Empresa|^Empresa|^Empregador/i,s=>/\p{L}{3}/u.test(s)&&!money(s));
  /* eventos: entre o cabeçalho (Proventos | Descontos) e os totais */
  const hl=L.find(l=>l.cells.some(c=>/^Proventos|^Vencimentos/i.test(c.s))&&l.cells.some(c=>/^Descontos/i.test(c.s)));
  const ev=[];
  if(hl){const px=hl.cells.find(c=>/^Proventos|^Vencimentos/i.test(c.s)).x, dx=hl.cells.find(c=>/^Descontos/i.test(c.s)).x, mid=(px+dx)/2+15;
    for(const l of L){if(l.t<=hl.t)continue;if(l.cells.some(c=>/^Total/i.test(c.s)))break;
      const v=[...l.cells].reverse().find(c=>money(c.s)!=null&&c.x>=px-30);if(!v)continue;
      const d=l.cells.find(c=>/\p{L}/u.test(c.s));if(!d)continue;
      ev.push({desc:d.s,cents:money(v.s),side:v.x>=mid?"d":"p"})}}
  const P=ev.filter(e=>e.side==="p"), big=P.slice().sort((a,b)=>b.cents-a.cents)[0], bd=big?fold(big.desc).toUpperCase():"";
  let kind="Salário";
  if(/13/.test(bd)&&/SAL|13O|13º/.test(bd)) kind="13º salário"+(/PARC\.?\s*0?1\b|1A PARC/.test(bd)?" (1ª parcela)":/PARC\.?\s*0?2\b|2A PARC/.test(bd)?" (2ª parcela)":"");
  else if(/FERIAS/.test(bd)) kind="Férias";
  else if(/ADIANT/.test(bd)&&!P.some(e=>/HORAS NORMAIS|SALARIO/.test(fold(e.desc).toUpperCase()))) kind="Adiantamento";
  let ref=null;if(mr){const m=/(\d{1,2})\s*\/\s*(\d{4})/.exec(mr);ref=`${m[2]}-${String(m[1]).padStart(2,"0")}`}
  let date=null;if(dc){const[d,m,y]=dc.split("/");date=`${y}-${m}-${d}`}
  if(!date&&ref) date=`${ref}-${kind==="Adiantamento"?"15":String(lastDay(ref))}`;
  if(!date) return null;
  /* convênio: página do extrato (total e atendimentos) ou, sem ela, o desconto de coparticipação */
  let conv=null;
  for(const pg of pages){const CL=pdfLines(pg), cf=CL.map(l=>l.cells.map(c=>c.s).join(" ")).join(" ");
    if(!/Conv[eê]nio|Coparticipa/i.test(cf)||CL.some(l=>l.cells.some(c=>/^Valor L[ií]quido/i.test(c.s))))continue;
    const tl=CL.find(l=>l.cells.some(c=>/^Total:?$/i.test(c.s)));const v=tl&&[...tl.cells].reverse().find(c=>money(c.s)!=null);if(!v)continue;
    /* atendimentos: linha com data e valor; as linhas seguintes sem valor continuam o nome do procedimento */
    const at=[];CL.forEach(l=>{if(l.t>=tl.t)return;const dc=l.cells.find(c=>/^\d{2}\/\d{2}\/\d{4}$/.test(c.s)), mc=[...l.cells].reverse().find(c=>money(c.s)!=null);
      if(dc&&mc){const[d,m,y]=dc.s.split("/");at.push({date:`${y}-${m}-${d}`,cents:money(mc.s),code:(l.cells.find(c=>/^\d{8}$/.test(c.s))||{}).s||"",txt:l.cells.filter(c=>c.x>dc.x-200&&c.x<dc.x&&/\p{L}/u.test(c.s)).map(c=>c.s).join(" ")})}
      else if(at.length&&!mc)at[at.length-1].txt+=" "+l.cells.map(c=>c.s).join(" ")});
    const ds=at.map(a=>a.date).sort(), by={};
    at.forEach(a=>{const k=convKind(a.txt,a.code);(by[k]=by[k]||{k,cents:0,n:0});by[k].cents+=a.cents;by[k].n++});
    conv={cents:money(v.s),n:at.length,from:ds[0]||"",to:ds[ds.length-1]||"",by:CONV_ORDER.map(k=>by[k]).filter(Boolean)};break}
  /* só conta no holerite que desconta o convênio (o do 13º traz o mesmo extrato, mas não desconta) */
  const cp=ev.find(e=>e.side==="d"&&/COPARTICIPA|CONVENIO/.test(fold(e.desc).toUpperCase()));
  if(!cp) conv=null; else if(!conv) conv={cents:cp.cents,n:0,from:"",to:""};
  return {kind,cents:liq,date,ref:ref||date.slice(0,7),emp:emp?titleCase(emp):"",tp,td,ev,conv,check:tp!=null&&td!=null?tp-td===liq:null};
}
/* tipo do atendimento do convênio, pelo nome do procedimento (e o código TUSS quando ajuda) */
export const CONV_ORDER=["Psicólogo","Médico","Pronto-socorro","Exames","Terapias","Outros"];
export function convKind(t,code){const u=fold(t).toUpperCase();
  if(/PSICOLOG|PSICOTERAP/.test(u)||/^5000047/.test(code)) return "Psicólogo";
  if(/PRONTO.?SOCORRO|EMERGENCIA|URGENCIA/.test(u)) return "Pronto-socorro";
  if(/CONSULTA|PSIQUIATR|^1010/.test(u)||/^1010/.test(code)) return "Médico";
  if(/EXAME|HEMOGRAMA|DOSAGEM|RAIO|RX\b|ULTRA.?SON|ULTRASS|RESSONAN|TOMOGRAF|ELETRO|ENDOSCOP|COLESTEROL|GLICOSE/.test(u)||/^4/.test(code)) return "Exames";
  if(/FISIOTERAP|FONOAUD|NUTRICION|TERAPIA OCUPAC|ACUPUNT/.test(u)) return "Terapias";
  return "Outros"}
/* dados técnicos do arquivo (sem conteúdo da fatura): cabeçalho, versão, tipo de proteção */
export function pdfInfo(b,file){
  let t="";const n=b.length;for(let i=0;i<n;i+=8192)t+=String.fromCharCode.apply(null,b.subarray(i,Math.min(n,i+8192)));
  const head=t.slice(0,8).replace(/[^\x20-\x7e]/g,"?"), off=t.indexOf("%PDF-"), enc=/\/Encrypt\s/.test(t);
  const ed=enc&&(/\/Filter\s*\/Standard[^>]{0,300}/.exec(t)||/\/Filter\s*\/[A-Za-z.]+[^>]{0,300}/.exec(t));
  const g=(re)=>{const m=ed&&re.exec(ed[0]);return m?m[1]:"-"};
  const hex=Array.from(b.subarray(0,16),x=>x.toString(16).padStart(2,"0")).join(" ");
  const sx=/startxref\s+(\d+)\s*%%EOF\s*$/.exec(t.slice(-1024));
  return {tipo:file.type||"?",kb:Math.round(n/1024),bytes:n,head,hex,off,ver:off>=0?t.substr(off,8):"-",startxref:sx?+sx[1]:-1,
    fim:t.slice(-16).replace(/[^\x20-\x7e]/g,"?"),pdf:/^%PDF-/.test(t.slice(0,1024))?1:0,
    enc:enc?`sim (filtro ${g(/\/Filter\s*\/([A-Za-z.]+)/)} V=${g(/\/V\s+(\d+)/)} R=${g(/\/R\s+(\d+)/)} bits=${g(/\/Length\s+(\d+)/)} cf=${g(/\/CFM\s*\/(\w+)/)})`:"não",
    eof:(t.match(/%%EOF/g)||[]).length,objstm:/\/ObjStm/.test(t)?1:0,xrefstm:/\/Type\s*\/XRef/.test(t)?1:0,
    producer:(/\/Producer\s*\(([^)]{0,40})/.exec(t)||[,"?"])[1].replace(/[^\x20-\x7e]/g,"?")};
}
/* diagnóstico: estrutura do PDF com nomes e números longos mascarados, para ajustar o leitor sem mandar a fatura */
