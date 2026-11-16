const express=require('express'),multer=require('multer'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PASS=process.env.ADMIN_PASSWORD||'102030duda$',PORT=process.env.PORT||3002;
const DATA=path.join(__dirname,'data'),UP=path.join(DATA,'uploads'),DB=path.join(DATA,'db.json');
fs.mkdirSync(UP,{recursive:true});
const seed={site:{name:'Nome da Loja',slogan:'Slogan da sua loja aqui',about:'Conte aqui a história da empresa: quem somos, o que vendemos e por quê.',email:'',whatsapp:'',instagram:'',address:'',color1:'#3b2418',color2:'#f29bb0',shop:'1',prices:'1',logo:'',hero:''},
products:[{id:'1',name:'Café Especial 250g',price:32.9,category:'Café',desc:'Grãos selecionados, torra média.',image:''},{id:'2',name:'Caneca Térmica',price:49.9,category:'Acessórios',desc:'Mantém a bebida quente por horas.',image:''},{id:'3',name:'Pelúcia Xícara',price:59.9,category:'Pelúcias',desc:'Macia, para abraçar.',image:''}],orders:[]};
let db;try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch{db=seed}
db.orders=db.orders||[];
const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,2));save();
const rm=f=>{if(f&&f.startsWith('/uploads/'))fs.unlink(path.join(DATA,f),()=>{})};
const up=multer({storage:multer.diskStorage({destination:UP,filename:(q,f,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(3).toString('hex')+path.extname(f.originalname).toLowerCase())}),
limits:{fileSize:8*1024*1024},fileFilter:(q,f,cb)=>cb(null,/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(f.mimetype))});
const tokens=new Set();
const auth=(req,res,next)=>{const t=req.get('x-token'),p=req.get('x-admin-password');
if((t&&tokens.has(t))||(p&&p===PASS))return next();res.status(401).json({error:'Senha ou sessão inválida'})};
const app=express();app.use(express.json());
app.use('/uploads',express.static(UP));app.use(express.static(path.join(__dirname,'public')));
app.get('/admin',(q,r)=>r.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/api/site',(q,r)=>r.json(db.site));
app.get('/api/products',(q,r)=>r.json(db.products));
app.post('/api/login',(req,res)=>{if(req.body.password!==PASS)return res.status(401).json({error:'Senha incorreta'});
const t=crypto.randomBytes(24).toString('hex');tokens.add(t);res.json({token:t})});
const keys=['name','slogan','about','email','whatsapp','instagram','address','color1','color2','shop','prices'];
app.put('/api/admin/site',auth,up.fields([{name:'logo',maxCount:1},{name:'hero',maxCount:1}]),(req,res)=>{
keys.forEach(k=>{if(req.body[k]!==undefined)db.site[k]=String(req.body[k]).slice(0,2000)});
for(const f of ['logo','hero']){const x=req.files&&req.files[f];if(x){rm(db.site[f]);db.site[f]='/uploads/'+x[0].filename}
if(req.body['remove_'+f]){rm(db.site[f]);db.site[f]=''}}
save();res.json(db.site)});
const fill=(p,b)=>{if(b.name!==undefined)p.name=String(b.name).slice(0,120);if(b.price!==undefined)p.price=Math.max(0,parseFloat(String(b.price).replace(',','.'))||0);
if(b.category!==undefined)p.category=String(b.category).slice(0,40)||'Outros';if(b.desc!==undefined)p.desc=String(b.desc).slice(0,1000)};
app.post('/api/admin/products',auth,up.single('image'),(req,res)=>{
const p={id:crypto.randomBytes(5).toString('hex'),name:'Produto',price:0,category:'Outros',desc:'',image:req.file?'/uploads/'+req.file.filename:''};
fill(p,req.body);db.products.push(p);save();res.json(p)});
app.put('/api/admin/products/:id',auth,up.single('image'),(req,res)=>{
const p=db.products.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Não encontrado'});
fill(p,req.body);if(req.file){rm(p.image);p.image='/uploads/'+req.file.filename}save();res.json(p)});
app.delete('/api/admin/products/:id',auth,(req,res)=>{
const i=db.products.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Não encontrado'});
rm(db.products[i].image);db.products.splice(i,1);save();res.json({ok:true})});
// ---- Pedidos ----
const STATUS=['novo','pago','enviado','entregue','cancelado'];
const hits=new Map();
const limited=ip=>{const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<600000);a.push(now);hits.set(ip,a);return a.length>15};
// Público: o cliente envia só quem é e o que quer (id + quantidade). Preços e total são SEMPRE recalculados aqui.
app.post('/api/orders',(req,res)=>{
if(db.site.shop==='0')return res.status(403).json({error:'Esta loja está em modo vitrine e não recebe pedidos.'});
if(limited(req.ip))return res.status(429).json({error:'Muitos pedidos em pouco tempo. Tente de novo em alguns minutos.'});
const b=req.body||{},name=String(b.name||'').trim().slice(0,80),contact=String(b.contact||'').trim().slice(0,80);
if(!name)return res.status(400).json({error:'Informe seu nome.'});
if(!contact)return res.status(400).json({error:'Informe um WhatsApp ou e-mail para contato.'});
if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)return res.status(400).json({error:'Carrinho vazio.'});
const qty=new Map();
for(const it of b.items){const q=parseInt(it&&it.qty,10);if(!(q>=1&&q<=99))return res.status(400).json({error:'Quantidade inválida.'});
const id=String(it.id);qty.set(id,Math.min(99,(qty.get(id)||0)+q))}
const items=[];
for(const [id,q] of qty){const p=db.products.find(x=>x.id===id);
if(!p)return res.status(400).json({error:'Um produto do carrinho não existe mais. Atualize a página.'});
items.push({id:p.id,name:p.name,price:p.price,qty:q})}
const total=Math.round(items.reduce((s,i)=>s+i.price*i.qty,0)*100)/100;
const o={id:crypto.randomBytes(5).toString('hex'),number:db.orders.reduce((m,x)=>Math.max(m,x.number),0)+1,createdAt:new Date().toISOString(),status:'novo',name,contact,items,total};
db.orders.push(o);save();res.json(o)});
// Admin
app.get('/api/admin/orders',auth,(q,r)=>r.json([...db.orders].reverse()));
app.put('/api/admin/orders/:id',auth,(req,res)=>{
const o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:'Não encontrado'});
const st=req.body&&req.body.status;if(!STATUS.includes(st))return res.status(400).json({error:'Status inválido'});
o.status=st;save();res.json(o)});
app.delete('/api/admin/orders/:id',auth,(req,res)=>{
const i=db.orders.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Não encontrado'});
db.orders.splice(i,1);save();res.json({ok:true})});

app.use((e,q,r,n)=>r.status(400).json({error:e.message}));
app.listen(PORT,()=>console.log(`Loja: http://localhost:${PORT}  |  Admin: http://localhost:${PORT}/admin`));
