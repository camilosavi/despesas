const {chromium}=require('playwright');const fs=require('fs');
const ROOT=process.argv[2]||process.cwd();
const T=Date.parse("2026-11-04T12:00:00Z"), BT=Date.parse("2026-11-01T12:00:00Z");
let id=0;const I=o=>({id:String(++id),createdAt:T+id,paid:false,pay:"Pix",...o});
const items=[
 I({type:"rec",desc:"Salário",cat:"sal",cents:500000,date:"2026-11-01",fell:"2026-10-30",paid:true,createdAt:BT-1}),
 I({type:"rec",desc:"Extra",cat:"extra",cents:30000,date:"2026-11-20",paid:true}),
 I({type:"desp",desc:"Inter · Fatura Inter",cat:"cartao",cents:90000,date:"2026-11-12",card:"Inter",pay:"Crédito",imp:"fatura-2026-11-12"}),
 I({type:"desp",desc:"Tênis",cat:"compras",cents:20000,date:"2026-11-12",card:"Inter",pay:"Crédito"}),
 I({type:"desp",desc:"Mercado Inter",cat:"merc",cents:15000,date:"2026-11-12",card:"Inter",pay:"Crédito",imp:"fatura-2026-11-12"}),
 I({type:"desp",desc:"Netflix",cat:"assin",cents:4000,date:"2026-11-12",card:"Inter",pay:"Crédito",group:"g1"}),
 I({type:"desp",desc:"Netflix",cat:"assin",cents:4000,date:"2026-12-12",card:"Inter",pay:"Crédito",group:"g1"}),
 I({type:"desp",desc:"Pan · Fatura Pan",cat:"cartao",cents:60000,date:"2026-10-20",card:"Pan",pay:"Crédito",imp:"fatura-2026-10-20"}),
 I({type:"desp",desc:"Sofá",cat:"casa",cents:25000,date:"2026-10-20",card:"Pan",pay:"Crédito",parc:"1/3",group:"g2"}),
 I({type:"desp",desc:"Sofá",cat:"casa",cents:25000,date:"2026-11-20",card:"Pan",pay:"Crédito",parc:"2/3",group:"g2"}),
 I({type:"desp",desc:"Natação",cat:"saude",cents:9000,date:"2026-11-05",pay:"Pix"}),
 I({type:"desp",desc:"Aluguel",cat:"casa",cents:120000,date:"2026-11-10",pay:"Pix"}),
 I({type:"desp",desc:"Mercado",cat:"merc",cents:35000,date:"2026-11-03",paid:true,paidAt:T}),
 I({type:"desp",desc:"Ração",cat:"outros",cents:5000,date:"2026-11-02",paid:true,paidAt:BT-5}),
 I({type:"desp",desc:"Almoço VR",cat:"alim",cents:3000,date:"2026-11-02",paid:true,pay:"VR"}),
];
const cfg={accts:[{id:"a",name:"Conta",cents:250000,at:"2026-11-01",atTs:BT}],cards:{Inter:{color:"#FF5A00",limit:300000,due:12,close:4},Pan:{color:"#0266B2",limit:200000,due:20},VR:{kind:"ben",color:"#0a0",bal:50000,at:"2026-11-01",atTs:BT,daily:3000,bday:5}},seeded:"1",onb:1};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:440,height:900}});
await ctx.addInitScript(([items,cfg])=>{try{if(!localStorage.getItem('despesas.v3')){localStorage.setItem('despesas.v3',JSON.stringify(items));localStorage.setItem('despesas.cfg3',JSON.stringify(cfg));localStorage.setItem('despesas.fx3','[]')}localStorage.setItem('despesas.sb',JSON.stringify({at:'x',rt:'y',exp:Date.now()+36e5*5,uid:'u',email:'t@t.t'}));localStorage.setItem('despesas.unlockAt',String(Date.now()))}catch(e){}},[items,cfg]);
const p=await ctx.newPage();await p.clock.install({time:new Date("2026-11-05T12:00:00Z")});
await p.route(/supabase|googleapis|cdnjs|jsdelivr|awesomeapi|frankfurter/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.goto('file://'+ROOT+'/index.html');await p.waitForTimeout(1500);
try{await p.fill('#lock input','Teste');await p.click('#lock button:has-text("Continuar")');await p.waitForTimeout(400);await p.keyboard.type('123456',{delay:60});await p.waitForTimeout(500);await p.keyboard.type('123456',{delay:60});await p.waitForTimeout(1200);const fb=await p.$('#lock button:has-text("Agora não"), #lock button:has-text("Pular")');if(fb)await fb.click()}catch(e){}
await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const o={};const ym="2026-11";
 o.hoje=today();o.accBal=accBal();o.endBal=endBal(ym);o.endBalDez=endBal("2026-12");
 for(const c of ["Inter","Pan"]){o["billShow."+c+".11"]=billShow(c,ym);o["billShow."+c+".12"]=billShow(c,"2026-12");o["billShow."+c+".10"]=billShow(c,"2026-10");o["free."+c]=cardFree(c)}
 o.gastouApp=sumT(inMonth(ym),"desp");o.entrouApp=sumT(inMonth(ym),"rec");
 return {o,backup:{app:"minhas-despesas",v:1,items:JSON.parse(localStorage.getItem('despesas.v3')),cfg:JSON.parse(localStorage.getItem('despesas.cfg3')),fx:[]}}});
fs.writeFileSync(__dirname+'/dif-app.json',JSON.stringify(r));console.log(JSON.stringify(r.o,null,0));await b.close()})();
