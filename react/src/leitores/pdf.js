/* Leitores de PDF portados do app atual (src/app.html): mesmas regras de leitura, calibradas com faturas, extratos e holerites reais.
   Aqui só entram funções que olham o texto do PDF; o que vira lançamento é decidido pelas telas do React. */
const brl = c => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const R = c => "R$ " + brl(c);
const pad = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const shiftYM = (ym, d) => { let [y, m] = ym.split("-").map(Number); m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + "-" + pad(m); };
const lastDay = ym => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const fold = t => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NOISE=new Set("bra sao paulo itu com br parcela the ltda app pag pagamento compra compras loja".split(" "));
const SYN={gasolina:"posto",combustivel:"posto",etanol:"posto",alcool:"posto",shell:"posto",ipiranga:"posto",abastecimento:"posto",
  supermercado:"mercado",supermercados:"mercado",mercado:"mercado",atacadao:"mercado",farmacia:"drogaria",drogasil:"drogaria",droga:"drogaria",
  oculos:"otica",oticas:"otica",otica:"otica",corrida:"uber",lanche:"ifood",parcelado:"parcelamento",parcelada:"parcelamento",parcelamento:"parcelamento"};
const toks=s=>(s||"").replace(/^[A-Za-zÀ-ú]+ · /,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3&&!NOISE.has(t)&&!/^\d+$/.test(t)).map(t=>SYN[t]||t);
function nameSim(a,b){
  const A=toks(a),B=toks(b);if(!A.length||!B.length) return 0;
  const hit=A.filter(x=>B.some(y=>x===y||(x.length>=4&&y.length>=4&&(x.startsWith(y)||y.startsWith(x))))).length;
  return hit/Math.max(A.length,B.length);
}
const closeC=(a,b)=>Math.abs(a-b)<=Math.max(1,Math.round(Math.max(a,b)*0.005));
const FIN_RE=/\bVL\.?\s?FAT\.?\s?EF\b|PARCELAMENTO DE FATURA|FATURA PARCELADA|\bPARC\.?\s?FAT/i;
/* categoria aprendida/regras: a tela injeta aqui (devolve a categoria ou vazio) */
let _catHook = () => null;
export const setCatLearn = fn => { _catHook = fn || (() => null); };
const catLearnGet = (t, d) => _catHook(t, d);
const PAY_CR_RE=/\b(pagamento|pgto|pagto|deb(?:ito)?\s*autom|fatura\s*paga|cr[eé]dito\s*de\s*parcelamento|parcelamento\s*de\s*fatura|fatura\s*parcelada|saldo\s*parcelado|cred\s*parc\s*fat|vl\.?\s*fat\.?\s*ef)\b/i;
const EST_CR_RE=/\b(estorno|cancelamento|devolu[cç][aã]o|reembolso|cashback|desconto|bonifica|isencao|isen[cç][aã]o|ajuste\s*a\s*cr[eé]dito|cr[eé]dito\s*em\s*confian[cç]a)\b/i;
const isPayCredit=r=>{const d=`${r.desc||""} ${r.shop||""}`;return !EST_CR_RE.test(d)&&PAY_CR_RE.test(d)};
/* estornos, devoluções, descontos e cashback na fatura: antes ficavam em credits (<0) e eram ignorados como "pagamento anterior",
   deixando a fatura no app maior que a do banco. Agora cancelam a compra de mesmo valor ou abatem nas compras da fatura. */
function settleInvoiceCredits(res){
  if(!res||!Array.isArray(res.rows)) return res;
  const rows=res.rows.map(r=>({...r}));
  let estTot=0,estN=0;
  const ests=rows.filter(r=>r.cents<0&&!isPayCredit(r));
  /* 1) compra de mesmo valor na mesma fatura: cancela os dois */
  ests.forEach(cr=>{
    const v=-cr.cents, crNm=cr.shop||cr.desc||"";
    let j=rows.findIndex(x=>x.cents>0&&!x.gone&&!x.prev&&closeC(x.cents,v)&&nameSim(x.shop||x.desc||"",crNm)>0);
    if(j<0) j=rows.findIndex(x=>x.cents===v&&!x.gone&&!x.prev);
    if(j>=0){rows[j].gone=1;cr.gone=1;estTot+=v;estN++}
  });
  /* 2) estorno parcial da mesma loja ou desconto de encargo/anuidade */
  ests.filter(cr=>!cr.gone).forEach(cr=>{
    const v=-cr.cents, crNm=cr.shop||cr.desc||"";
    const j=rows.findIndex(x=>x.cents>v&&!x.gone&&!x.prev&&nameSim(x.shop||x.desc||"",crNm)>=0.35);
    if(j>=0){rows[j].cents-=v;rows[j].desc=`${rows[j].desc} (c/ estorno −${R(v)})`;cr.gone=1;estTot+=v;estN++}
  });
  /* 3) estorno de compra de fatura anterior, cashback ou desconto geral: abate das maiores compras para fechar com o total do banco */
  ests.filter(cr=>!cr.gone).forEach(cr=>{
    let rem=-cr.cents;
    const deb=rows.filter(x=>x.cents>0&&!x.gone&&!x.prev).sort((a,b)=>b.cents-a.cents);
    for(const x of deb){
      if(rem<=0) break;
      if(x.cents>rem){x.cents-=rem;x.desc=`${x.desc} (c/ desconto −${R(rem)})`;estTot+=rem;rem=0;break}
      else if(x.cents===rem){x.gone=1;estTot+=rem;rem=0;break}
    }
    if(rem===0){cr.gone=1;estN++}
  });
  return {...res,rows:rows.filter(r=>!r.gone),estorno:(res.estorno||0)+estTot,estornoN:(res.estornoN||0)+estN};
}
function parseInvoice(pages){
  const r=_parseInvoiceRaw(pages);
  return settleInvoiceCredits(r);
}
function _parseInvoiceRaw(pages){
  const MONEY=/^-?\d{1,3}(\.\d{3})*,\d{2}$/, DATE=/^\d{2}\/\d{2}\/\d{4}$/;
  const toC=v=>{const neg=v.startsWith("-");return (neg?-1:1)*Number(v.replace(/[-.]/g,"").replace(",",""))};
  const iso=d=>{const[a,b,c]=d.split("/");return `${c}-${b}-${a}`};
  const all=pages.map(p=>p.items.map(i=>i.s).join(" ")).join(" \n ").replace(/\s+/g," ");
  if(/Banco Inter|bancointer|inter\.co\//i.test(all)) return parseInter(pages,all);
  if(/Banco Pan\b|bancopan/i.test(all)) return parsePan(pages,all);
  if(/Nu Pagamentos|Nubank/i.test(all)&&/TRANSA[ÇC][ÕO]ES/.test(all)) return parseNubank(pages,all);
  if(/Santander/i.test(all)&&/Detalhamento da Fatura/i.test(all)) return parseSantander(pages,all);
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
function pdfLines(pg){
  const it=[...pg.items].filter(i=>i.s.trim()).sort((a,b)=>a.t-b.t||a.x-b.x), L=[];
  for(const i of it){const l=L.find(l=>Math.abs(l.t-i.t)<2);if(l)l.items.push(i);else L.push({t:i.t,items:[i]})}
  return L.map(l=>{const cells=[];l.items.sort((a,b)=>a.x-b.x).forEach(i=>{const c=cells[cells.length-1],gap=c?i.x-c.end:99;
    if(c&&gap<6){c.s+=(gap<1.5?"":" ")+i.s;c.end=i.x+(i.w||i.s.length*5)}else cells.push({s:i.s,x:i.x,end:i.x+(i.w||i.s.length*5)})});
    cells.forEach(c=>c.s=c.s.replace(/\s+/g," ").trim());return {t:l.t,cells}});
}
const moneyC=s=>{const m=/^(\+|-)?\s*R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/.exec(s.trim());if(!m)return null;
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
/* Nubank (out/2026): capa "Data de vencimento: DD MÊS AAAA"; "Resumo da fatura atual" (Fatura anterior, Pagamento recebido,
   Total de compras, Outros lançamentos, Total a pagar); páginas "TRANSAÇÕES DE DD MÊS A DD MÊS" com linhas
   "DD MÊS | •••• NNNN | descrição - Parcela i/n | R$ valor" (compra por NuPay não tem o final do cartão); um bloco por titular
   ("Nome R$ subtotal", sem data). "Pagamentos e Financiamentos": "Pagamento em DD MÊS" (ignorado), parcelamento de compra
   ('Parcelamento de Compra "LOJA" - Parcela i/n' + linha "Total a pagar: … (valor da transação de R$ X …)"), Pix no crédito e boleto
   no crédito (nome - Parcela i/n) e "Crédito de parcelamento de compra" (a compra original que virou parcela). */
const NU_MES={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const nuC=s=>moneyC(String(s).replace(/[−–]/g,"-"));
function parseNubank(pages,all){
  const dm=/Data de vencimento:?\s*(\d{1,2}) ([A-Za-zçÇ]{3}) (\d{4})/i.exec(all), dmo=dm&&NU_MES[dm[2].toLowerCase()];
  const due=dm&&dmo?`${dm[3]}-${String(dmo).padStart(2,"0")}-${dm[1].padStart(2,"0")}`:"";
  const cm=/DE \d{1,2} [A-ZÇ]{3} A (\d{1,2}) ([A-ZÇ]{3})/i.exec(all), closeD=cm?+cm[1]:0, closeM=cm&&NU_MES[cm[2].toLowerCase()]||(dmo||12);
  const dueY=dm?+dm[3]:new Date().getFullYear(), closeY=closeM>(dmo||12)?dueY-1:dueY;
  let rows=[];const fin=[];
  pages.forEach(pg=>{
    const L=pdfLines(pg);
    if(!L.some(l=>/^TRANSA[ÇC][ÕO]ES\b/i.test(l.cells[0]&&l.cells[0].s||""))) return;
    for(const ln of L){
      const c=ln.cells, d=/^(\d{2}) ([A-ZÇa-zç]{3})$/.exec(c[0]&&c[0].s||"");
      if(!d||!NU_MES[d[2].toLowerCase()]||c.length<3) continue;
      const k=c.length-1, cents=nuC(c[k].s);if(cents==null) continue;
      let desc=c.slice(1,k).map(x=>x.s).filter(s=>!/^[•·.]{2,}\s*\d{4}$/.test(s)).join(" ").replace(/\s+/g," ").trim();
      if(/^Pagamento em \d/i.test(desc)||/^Cr[eé]dito de parcelamento/i.test(desc)) continue;
      const m=NU_MES[d[2].toLowerCase()], y=m>closeM?closeY-1:closeY;
      const date=`${y}-${String(m).padStart(2,"0")}-${d[1]}`;
      /* parcelamento de compra: vira a parcela da loja e apaga a compra original (mesmo nome e valor da transação) */
      const pc=/^Parcelamento de Compra "(.+)" - Parcela (\d+)\/(\d+)$/i.exec(desc);
      if(pc){
        const nxt=L[L.indexOf(ln)+1], tx=nxt&&/valor da transa[çc][ãa]o de (R\$\s*[\d.]+,\d{2})/i.exec(nxt.cells.map(x=>x.s).join(" ")+" "+(L[L.indexOf(ln)+2]?L[L.indexOf(ln)+2].cells.map(x=>x.s).join(" "):""));
        fin.push({name:pc[1].trim().toLowerCase(),cents:tx?moneyC(tx[1]):null});
        desc=`${pc[1].trim()} - Parcela ${pc[2]}/${pc[3]}`;
      }
      const pm=/\s*-\s*Parcela (\d+)\/(\d+)$/i.exec(desc);if(pm) desc=desc.slice(0,pm.index).trim();
      desc=desc.replace(/\s+-\s+NuPay$/i,"");
      rows.push({date,desc:pm?parcTag(desc,+pm[1],+pm[2]):desc,shop:"",cents,orig:desc.toLowerCase()});
    }
  });
  fin.forEach(f=>{const j=rows.findIndex(r=>!r.gone&&!/Parc\./.test(r.desc)&&r.orig===f.name&&(f.cents==null||r.cents===f.cents));if(j>=0)rows[j].gone=1});
  rows=rows.filter(r=>!r.gone).map(({orig,gone,...r})=>r);
  let total=null,ant=null,pag=null;
  for(const pg of pages) for(const ln of pdfLines(pg)){const c=ln.cells;if(c.length<2) continue;
    const v=nuC(c[c.length-1].s);if(v==null) continue;
    if(/^Fatura anterior$/i.test(c[0].s)) ant=v; else if(/^Pagamento recebido$/i.test(c[0].s)) pag=v; else if(/^Total a pagar$/i.test(c[0].s)) total=v}
  if(ant!=null&&pag!=null&&ant+pag>0) rows.push({date:due?shiftYM(due.slice(0,7),-1)+due.slice(7):today(),desc:"Saldo da fatura anterior",shop:"",cents:ant+pag,prev:true});
  return {bank:"Nubank",due,rows,total,close:closeD};
}
/* Santander (out/2026): capa com "Total a Pagar / Vencimento / Seu limite é" em caixas (valor logo abaixo do rótulo) e
   "compras e pagamentos realizados até DD/MM"; "Detalhamento da Fatura" por cartão: "Pagamento e Demais Créditos" e "Despesas"
   com colunas "Compra Data Descrição Parcela R$ US$"; linha "DD/MM DESCRIÇÃO [NN/NN] valor" (sem ano, sem R$), termina em
   "VALOR TOTAL"; "Resumo da Fatura": Saldo Anterior, (-) Total de pagamentos, (=) Saldo Desta Fatura. */
function parseSantander(pages,all){
  let due="";
  pages.some(pg=>{const v=pg.items.find(i=>/^Vencimento$/i.test(i.s.trim()));if(!v)return false;
    const d=pg.items.filter(i=>/^\d{2}\/\d{2}\/\d{4}$/.test(i.s.trim())&&i.t>v.t&&i.t<v.t+30&&Math.abs(i.x-v.x)<50)[0];
    if(d){const[a,b,y]=d.s.trim().split("/");due=`${y}-${b}-${a}`}return !!d});
  const fm=/realizados at[eé] (\d{2})\/(\d{2})/i.exec(all), cm=fm?+fm[2]:0, dM=due?+due.slice(5,7):0, dY=due?+due.slice(0,4):new Date().getFullYear();
  const cy=cm&&dM&&cm>dM?dY-1:dY;
  const MON=/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/, toC=v=>(v.startsWith("-")?-1:1)*Number(v.replace(/[-.]/g,"").replace(",",""));
  let rows=[],sec="",total=null,ant=null,pag=null;
  for(const pg of pages){
    for(const ln of pdfLines(pg)){
      const c=ln.cells, c0=c[0]&&c[0].s||"";
      if(/^Pagamento e Demais Cr[eé]ditos$/i.test(c0)){sec="cred";continue}
      if(/^Despesas$/i.test(c0)){sec="desp";continue}
      if(/^VALOR TOTAL$/i.test(c0)||/^Resumo da Fatura$/i.test(c0)){sec="";continue}
      const mv=c.slice(1).find(x=>MON.test(x.s));
      if(/^Saldo Anterior$/i.test(c0)&&mv) ant=toC(mv.s); else if(/^\(-\) Total de pagamentos$/i.test(c0)&&mv) pag=toC(mv.s); else if(/^\(=\) Saldo Desta Fatura$/i.test(c0)&&mv) total=toC(mv.s);
      if(!sec) continue;
      const d=/^(\d{2})\/(\d{2})(?:\s+(.*))?$/.exec(c0);if(!d||!mv) continue;
      const vi=c.indexOf(mv);if(vi<1&&!d[3]) continue;
      const pcell=c.slice(1,vi).find(x=>/^\d{1,2}\/\d{1,2}$/.test(x.s)), pm=pcell&&/^(\d{1,2})\/(\d{1,2})$/.exec(pcell.s);
      const desc=[d[3]||"",...c.slice(1,vi).filter(x=>x!==pcell).map(x=>x.s)].join(" ").replace(/\s+/g," ").trim();
      if(!desc) continue;
      const cents=toC(mv.s);
      if(sec==="cred"&&/DEB(ITO)? AUTOM|PAGAMENTO|PGTO|PAGTO/i.test(desc)) continue;
      const m=+d[2], y=cm&&m>cm?cy-1:cy;
      rows.push({date:`${y}-${d[2]}-${d[1]}`,desc:pm?parcTag(desc,+pm[1],+pm[2]):desc,shop:"",cents:sec==="cred"&&cents>0?-cents:cents});
    }
  }
  rows.filter(r=>r.cents<0&&!FIN_RE.test(r.desc)).forEach(cr=>{const j=rows.findIndex(x=>x.cents===-cr.cents&&!x.gone);if(j>=0){rows[j].gone=1;cr.gone=1}});
  rows=rows.filter(r=>!r.gone);
  if(ant!=null&&pag!=null&&ant-pag>0) rows.push({date:due?shiftYM(due.slice(0,7),-1)+due.slice(7):today(),desc:"Saldo da fatura anterior",shop:"",cents:ant-pag,prev:true});
  return {bank:"Santander",due,rows,total,close:fm?+fm[1]:0};
}
/* o que o app já sabe ler (mostrado na lista de cartões e na tela Você) — manter em dia quando calibrar um layout novo */
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
/* categoria aprendida (out/2026): quando a pessoa troca a categoria de um lançamento, o nome passa a vir nela nas
   próximas importações. cfg.catLearn["desp|nome"] = cat */
const titleCase=s=>s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
function invoiceEntry(r){
  if(r.prev) return {name:"Saldo da fatura anterior",cat:"cartao",parc:"",fee:false};
  if(/PARCELAMENTO DE FATURA|FATURA PARCELADA/i.test(r.desc)){const pm=/Parc\.?\s*(\d+)\s*\/\s*(\d+)/i.exec(r.desc);return {name:"Parcelamento da fatura",cat:"cartao",parc:pm?`${+pm[1]}/${+pm[2]}`:"",fee:false}}
  const pm=/Parc\.?\s*(\d+)\s*\/\s*(\d+)/i.exec(r.desc);
  const fee=/^(IOF|Juros|Multa|ANUIDADE|AVAL|Tarifa|Encargo)/i.test(r.desc);
  let name=r.shop&&!fee?titleCase(r.shop):r.desc.replace(/\s*-?\s*Parc\.?\s*\d+\s*\/\s*\d+/i,"").replace(/\s+(Int|Visa|Master(card)?)$/i,"").trim();
  if(!r.shop&&name&&name===name.toUpperCase()&&/[A-Z]{3}/.test(name)) name=titleCase(name);
  if(/^IOF Transacoes Exterior/i.test(r.desc)) name=`IOF exterior · ${titleCase(r.shop||"")}`.trim();
  else if(/Exterior/i.test(r.desc)&&r.shop) name=`${titleCase(r.shop)} (exterior)`;
  else if(/Retirada|Saque/i.test(r.desc)&&r.shop) name=`${titleCase(r.shop)} (saque)`;
  /* Inter: Pix no crédito parcelado e o IOF dele; intermediadores de pagamento (EBN *XSOLLA, PAYPAL *LOJA) */
  if(/^PIX CRED/i.test(r.desc)) name=r.who?`${titleCase(String(r.who).replace(/\b(S\.?\s?\/?A|LTDA|ME|EIRELI|EPP)\b\.?/gi,"").replace(/\s{2,}/g," ").trim())} (Pix no crédito)`:"Pix no crédito";
  else if(/^IOF\s+CREDITO\s+PARC/i.test(r.desc)) name="IOF do Pix no crédito";
  else if(!fee&&/^(EBN|PAYPAL|PP|DL)\s*\*\s*\S/i.test(name)) name=name.replace(/^(EBN|PAYPAL|PP|DL)\s*\*\s*/i,"");
  if(/xsolla/i.test(name)) name="Xsolla (jogo/assinatura)";
  const t=(r.shop+" "+r.desc+" "+(r.who||"")).toLowerCase();
  const cat=fee?"outros":/supermerc|(?<!mercado\*)mercado(?!\*| ?livre)|atacad|hortifr|assai|carrefour|pao de acucar/.test(t)?"merc":
    /restaur|burg|bar\b|pub|sorvet|lanch|pizza|cafe|padaria|ifood|food|steak|outback|nutri/.test(t)?"alim":
    /wellhub|gympass|academ|smart ?fit|decathlon|centauro|netshoes|nike|adidas|under armour|track ?& ?field|esporte|sport|futebol/.test(t)?"lazer":
    /farm|drog|clinic|saude|otica/.test(t)?"saude":
    /cine|parque|show|ingresso|teatro|steam|playstation|\bpsn\b|xbox|nintendo|epic ?games|riot|blizzard|roblox|garena/.test(t)?"lazer":
    /xsolla|ubisoft|game ?pass|ps ?plus|anthropic|claude|netflix|spotify|youtube|apple[. ]com|google|prime|disney|hbo|assinat|patreon|udemy|subscription/.test(t)?"assin":
    /\bclaro\b|\bvivo\b|\btim\b|\boi\b|energia|enel|cpfl|sabesp|internet|telefon/.test(t)?"casa":
    /uber|99|posto|combust|estacion|onibus|metro/.test(t)?"transp":
    /magazine|hobby|caedu|renner|riachuelo|americanas|magalu|amazon|shein|gradi|loja|shop/.test(t)?"compras":"outros";
  return {name,cat:fee?cat:catLearnGet("desp",name)||cat,parc:pm?`${+pm[1]}/${+pm[2]}`:"",fee};
}

let PDFJS=null, imp=null;
function loadPdfJs(){
  if(PDFJS) return Promise.resolve(PDFJS);
  const base="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  return new Promise((ok,no)=>{const sc=document.createElement("script");sc.src=base+"pdf.min.js";
    sc.onload=()=>{const L=window.pdfjsLib||window["pdfjs-dist/build/pdf"];if(!L)return no(new Error("pdfjs"));L.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.js";PDFJS=L;ok(L)};
    sc.onerror=()=>no(new Error("offline"));document.head.appendChild(sc)});
}
async function pdfPagesOf(file){
  let bytes=new Uint8Array(await file.arrayBuffer());const info=pdfInfo(bytes,file);if(info.off>0) bytes=bytes.subarray(info.off);
  const L=await loadPdfJs(), doc=await L.getDocument({data:bytes}).promise, pages=[];
  for(let n=1;n<=doc.numPages;n++){const pg=await doc.getPage(n),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();
    pages.push({h:vp.height,w:vp.width,items:tc.items.map(i=>({s:i.str,x:i.transform[4],w:i.width,t:vp.height-i.transform[5]}))})}
  return pages;
}
/* vários arquivos de uma vez: lê faturas de cartão (PDF ou OFX, atuais e antigas para controle histórico) e/ou holerites */
function pdfInfo(b,file){
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
const CONTAS=[["Claro",/Claro S\/?A|minhaclaro|claro\.com\.br/i],["Vivo",/Telef[oô]nica Brasil|\bVivo\b/i],["TIM",/\bTIM S\.?A\b/i],["Oi",/\bOi S\.?A\b/i],
  ["Enel",/\bEnel\b/i],["CPFL",/\bCPFL\b/i],["Elektro",/Elektro/i],["Sabesp",/Sabesp/i],["Comgás",/Comg[aá]s/i]];
/* ---------- extrato da conta (entradas e saídas) ----------
   Calibrado com o extrato do Inter ("Saldo total", "N de Mês de AAAA Saldo do dia: R$ X", linhas
   "Tipo: "detalhe"  valor  saldo por transação"). Serve para: atualizar o Saldo na conta com o saldo do extrato,
   marcar como pago o que já saiu e lançar o que ainda não está no app. Transferências entre contas da própria pessoa,
   investimento e pagamento de fatura ficam desmarcados. Só movimentos a partir de MIN_DUE. */
const MES_LONG={janeiro:1,fevereiro:2,"março":3,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
/* linha de extrato no formato do Inter: tipo + "detalhe" (igual no PDF, no OFX e no CSV).
   Pix: "Cp :99999999-NOME" (ou "237 328 1393014 NOME" na portabilidade de salário) → quem; compra no débito: "No estabelecimento LOJA" → loja */
function extRow(date,cents,kind,det){
  const who=/^(?:Cp\s*:\s*)?[\d ]+-?\s*(.+)$/.exec(det), shop=/^No estabelecimento\s+(.+)$/i.exec(det);
  return {date,cents,kind,det,who:shop?"":who?who[1].trim():det,shop:shop?shop[1].trim():""};
}
/* "Crédito liberado · Pix no Crédito" e o Pix enviado do mesmo valor no mesmo dia: o valor vai na fatura do cartão, não na conta */
function markPixCred(rows){
  rows.forEach(r=>{if(/cr[eé]dito liberado/i.test(fold(r.kind))&&/pix no cr[eé]dito/i.test(fold(r.det)||fold(r.who))){
    r.pixCred=true;
    const o=rows.find(q=>!q.pixCred&&q.cents<0&&q.cents===-r.cents&&q.date===r.date&&/pix/i.test(fold(q.kind)));if(o)o.pixCred=true}});
}
function parseExtrato(pages){
  const PL=pages.map(pdfLines), flat=PL.map(L=>L.map(l=>l.cells.map(c=>c.s).join(" ")).join("\n")).join("\n");
  if(!/Saldo do dia:/i.test(flat)||!/Saldo (total|dispon)/i.test(flat)) return null;
  const inst=/Institui[çc][ãa]o:\s*([^,\n]+)/i.exec(flat), bank=/Banco Inter|Inter&Co/i.test(flat)?"Inter":inst?inst[1].trim().replace(/^Banco\s+/i,""):"Conta";
  const sol=/Solicitado em:\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{1,2})h(\d{2}))?/i.exec(flat);
  const per=/Per[íi]odo:\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(flat);
  const at=sol?`${sol[3]}-${sol[2]}-${sol[1]}`:per?`${per[6]}-${per[5]}-${per[4]}`:today();
  const atTs=sol&&sol[4]?new Date(+sol[3],+sol[2]-1,+sol[1],+sol[4],+sol[5]).getTime():new Date(at+"T23:59:00").getTime();
  let bal=null, holder="";
  const L0=PL[0]||[];
  L0.forEach((l,i)=>{const t=l.cells.map(c=>c.s).join(" ");
    if(bal==null&&/Saldo total/i.test(t)){for(const n of L0.slice(i+1,i+3)){const v=n.cells.map(c=>moneyC(c.s)).find(x=>x!=null);if(v!=null){bal=v;break}}}
    if(!holder&&/^CPF|CPF\/CNPJ/i.test(t)&&i>0) holder=L0[i-1].cells.map(c=>c.s).join(" ").trim()});
  const rows=[];let day=null;
  PL.forEach(L=>L.forEach(l=>{
    const c0=l.cells[0]&&l.cells[0].s||"", dh=/^(\d{1,2}) de ([A-Za-zçÇ]+) de (\d{4})/i.exec(c0);
    if(dh&&MES_LONG[dh[2].toLowerCase()]){day=`${dh[3]}-${pad(MES_LONG[dh[2].toLowerCase()])}-${pad(+dh[1])}`;return}
    if(!day) return;
    const mi=l.cells.map((c,k)=>moneyC(c.s)!=null?k:-1).filter(k=>k>0);
    if(mi.length<2) return;
    const v=moneyC(l.cells[mi[mi.length-2]].s), desc=l.cells.slice(0,mi[mi.length-2]).map(c=>c.s).join(" ").trim();
    if(!desc||!v) return;
    const m=/^([^:"]+):\s*"?(.*?)"?$/.exec(desc);
    rows.push(extRow(day,v,m?m[1].trim():desc,m?m[2].trim():""));
  }));
  markPixCred(rows);
  if(!rows.length&&bal==null) return null;
  return {bank,at,atTs,bal,holder,rows,from:per?`${per[3]}-${per[2]}-${per[1]}`:"",to:per?`${per[6]}-${per[5]}-${per[4]}`:at};
}
function parseConta(pages){
  const all=pages.map(p=>pdfLines(p).map(l=>l.cells.map(c=>c.s).join(" ")).join(" \n ")).join(" \n ").replace(/[ \t]+/g," ");
  const flat=all.replace(/\s+/g," ").replace(/de \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/gi," ");
  const cnt=(re)=>{const m={};let x;while((x=re.exec(flat)))m[x[1]]=(m[x[1]]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]};
  const dv=cnt(/Vencimento[^0-9]{0,80}?(\d{2}\/\d{2}\/\d{4})/gi);
  const vv=cnt(/(?:Total a pagar|Valor total|Valor a pagar|Valor do documento|Total da fatura)[^0-9]{0,40}?R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/gi);
  if(!dv||!vv) return null;
  const p=CONTAS.find(([,re])=>re.test(flat)), [d,m,y]=dv[0].split("/");
  return {name:p?p[0]:"Conta",due:`${y}-${m}-${d}`,cents:Number(vv[0].replace(/\./g,"").replace(",","")),auto:/D[ée]bito Autom[aá]tico/i.test(flat)};
}
/* passagem aérea (e-ticket/recibo de compra): total, trechos e datas → abre o lançamento já preenchido; cartão e parcelas ele escolhe no formulário */
function parsePassagem(pages){
  const lines=pages.flatMap(pg=>pdfLines(pg)).map(l=>l.cells.map(c=>c.s).join("  "));
  const MES={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
  const dts=[],cod=[];let dl=null,maxP=0;
  for(const t of lines){
    for(const m of t.matchAll(/(\d{2}) ([A-Za-zç]{3})[a-zç]* (\d{4}) \d{2}:\d{2}/g)){const k=MES[m[2].toLowerCase()];if(k) dts.push(`${m[3]}-${String(k).padStart(2,"0")}-${m[1]}`)}
    for(const m of t.matchAll(/(?:^|\s)([A-Z]{3}) - [A-Za-zÀ-ú]/g)) if(!/^(ADT|CHD|INF)$/.test(m[1])) cod.push(m[1]);
    /* "Prazo" da reserva: "25 OUT 23:59" (sem ano; o PDF vem com espaços no meio dos números) */
    const pm=!dl&&/(\d{1,2}) ([A-Za-zç]{3}) (\d{2}): ?(\d{2})/.exec(t.replace(/(\d) (\d)/g,"$1$2"));
    if(pm&&MES[pm[2].toLowerCase()]) dl={d:+pm[1],m:MES[pm[2].toLowerCase()],hm:`${pm[3]}:${pm[4]}`};
    const px=/^(\d{1,2})x\b/.exec(t.trim());if(px) maxP=Math.max(maxP,+px[1]);
  }
  if(dts.length<2||!lines.some(t=>/\bTarifa\b/i.test(t))) return null;
  /* linha de valores: 4+ "R$ x" — o último é o total (confere: soma dos três anteriores) */
  let vals=null;
  for(const t of lines){const v=[...t.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map(m=>Number(m[1].replace(/\./g,"").replace(",","")));if(v.length>=4)vals=v}
  if(!vals) return null;
  const cents=vals[vals.length-1], soma=vals.slice(-4,-1).reduce((a,b)=>a+b,0);
  dts.sort();
  const reserva=lines.some(t=>/Reserva A[ée]rea|\bReservado\b/i.test(t));
  let until="";
  if(reserva&&dl){const t0=(typeof today==="function"?today():new Date().toISOString().slice(0,10)), y0=+t0.slice(0,4);
    const mk=y=>`${y}-${String(dl.m).padStart(2,"0")}-${String(dl.d).padStart(2,"0")}`;until=mk(y0)<t0?mk(y0+1):mk(y0)}
  return {cents,go:dts[0],from:cod[0]||"",to:cod.length>1?cod[cod.length-1]:"",sumOk:Math.abs(soma-cents)<=1,reserva,until,untilHm:dl?dl.hm:"",maxP};
}
function parseHolerite(pages){
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
  else if(P.some(e=>is13ev(e.desc))&&!P.some(e=>/HORAS NORMAIS|SALARIO (?:MENSAL|BASE|NORMAL)|^SALARIO$|DIAS TRABALHADOS/.test(fold(e.desc).toUpperCase()))){
    const t=fold(flat).toUpperCase()+" "+P.map(e=>fold(e.desc).toUpperCase()).join(" ");
    kind="13º salário"+(/PARC\.?\s*0?1\b|1A\s*PARC|PRIMEIRA PARC|ADIANT/.test(t)?" (1ª parcela)":/PARC\.?\s*0?2\b|2A\s*PARC|SEGUNDA PARC/.test(t)?" (2ª parcela)":"")}
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
/* evento de 13º: "13º SALÁRIO", "1ª PARC. 13 SAL", "DÉCIMO TERCEIRO"… */
const is13ev=d=>{const t=fold(d).toUpperCase();return /DECIMO TERCEIRO/.test(t)||/\b13/.test(t)&&/SAL|13O|13º|PARC|ADIANT/.test(t)};
const CONV_ORDER=["Psicólogo","Médico","Pronto-socorro","Exames","Terapias","Outros"];
function convKind(t,code){const u=fold(t).toUpperCase();
  if(/PSICOLOG|PSICOTERAP/.test(u)||/^5000047/.test(code)) return "Psicólogo";
  if(/PRONTO.?SOCORRO|EMERGENCIA|URGENCIA/.test(u)) return "Pronto-socorro";
  if(/CONSULTA|PSIQUIATR|^1010/.test(u)||/^1010/.test(code)) return "Médico";
  if(/EXAME|HEMOGRAMA|DOSAGEM|RAIO|RX\b|ULTRA.?SON|ULTRASS|RESSONAN|TOMOGRAF|ELETRO|ENDOSCOP|COLESTEROL|GLICOSE/.test(u)||/^4/.test(code)) return "Exames";
  if(/FISIOTERAP|FONOAUD|NUTRICION|TERAPIA OCUPAC|ACUPUNT/.test(u)) return "Terapias";
  return "Outros"}
const convTxt=by=>(by||[]).map(b=>`${b.k.toLowerCase()} ${R(b.cents)}`).join(" · ");
/* nome do evento: siglas (PLR, I.N.S.S.) ficam em maiúsculas */
export { parseInvoice, parseExtrato, parseConta, parsePassagem, parseHolerite, pdfPagesOf, invoiceEntry, pdfLines, isPayCredit, convKind, pdfInfo, loadPdfJs, titleCase, nameSim, closeC, extRow };
