const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const num=(v,max=1e9)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)fail(400,'Invalid number');return v;};
const id=v=>{if(typeof v!=='string'||!/^[\w-]{8,80}$/.test(v))fail(400,'Invalid identifier');return v;};
const cookie=(r,n)=>r.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))?.slice(n.length+1)||'';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const json=(v,status=200,c)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(c?{'Set-Cookie':c}:{})}});
const setCookie=(name,value,age,admin=false)=>`${name}=${value}; Path=${admin?'/api/admin':'/'}; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function admin(request,db,now){const t=cookie(request,'peach_admin');if(!t||!await db.prepare('SELECT 1 FROM admins WHERE token=? AND expires>?').bind(await hash(t),now).first())fail(401,'请先登录管理后台');}
async function player(request,db){const p=cookie(request,'peach_player');if(!p||!await db.prepare('SELECT 1 FROM players WHERE id=?').bind(p).first())fail(403,'请刷新页面后重试');return p;}
const ONLINE=`WITH ordered AS (SELECT player,started,started+elapsed AS finish,MAX(started+elapsed) OVER(PARTITION BY player ORDER BY started,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous FROM visits), online AS (SELECT player,SUM(MAX(0,finish-MAX(started,COALESCE(previous,started)))) AS seconds,COUNT(*) AS visits FROM ordered GROUP BY player)`;
async function report(db,now){
 const result=await db.batch([
  db.prepare(`${ONLINE} SELECT (SELECT COUNT(*) FROM players) AS players,(SELECT COUNT(*) FROM visits) AS visits,(SELECT COUNT(DISTINCT player) FROM visits WHERE ended=0 AND seen>?) AS onlineNow,COALESCE((SELECT SUM(seconds) FROM online),0) AS totalSeconds,COALESCE((SELECT MAX(elapsed) FROM visits),0) AS longestVisitSeconds,(SELECT COUNT(*) FROM rounds WHERE status='completed' AND demo=0) AS completedRounds`).bind(now-90),
  db.prepare(`${ONLINE}, round_totals AS (SELECT player,COUNT(*) AS rounds,SUM(status='completed') AS completed,SUM(CASE WHEN status='completed' THEN delivered ELSE 0 END) AS caught FROM rounds WHERE demo=0 GROUP BY player) SELECT SUBSTR(p.id,1,8) AS player,p.created AS joined,p.seen AS lastSeen,COALESCE(o.seconds,0) AS onlineSeconds,COALESCE(o.visits,0) AS visits,COALESCE(r.rounds,0) AS rounds,COALESCE(r.completed,0) AS completed,COALESCE(r.caught,0) AS caught,COALESCE(json_extract(s.payload,'$.bank'),0) AS bank,COALESCE(json_extract(s.payload,'$.level'),0) AS level,s.updated AS savedAt,COALESCE(s.revision,0) AS revision FROM players p LEFT JOIN online o ON o.player=p.id LEFT JOIN round_totals r ON r.player=p.id LEFT JOIN saves s ON s.player=p.id ORDER BY onlineSeconds DESC LIMIT 200`),
  db.prepare('SELECT id,SUBSTR(player,1,8) AS player,started,updated,status,duration,caught,delivered,escaped,total,demo FROM rounds ORDER BY updated DESC LIMIT 200'),
  db.prepare('SELECT id,SUBSTR(player,1,8) AS player,started,seen,elapsed,ended FROM visits ORDER BY started DESC LIMIT 200'),
  db.prepare("SELECT date(started,'unixepoch') AS day,COUNT(DISTINCT player) AS visitors FROM visits WHERE started>=? GROUP BY day").bind(Math.floor(now/86400)*86400-6*86400)
 ]);
 const summary=result[0].results[0],players=result[1].results;summary.averageSeconds=summary.players?summary.totalSeconds/summary.players:0;summary.longestPlayer=players[0]||null;
 const daily=Array.from({length:7},(_,i)=>{const day=new Date((now-(6-i)*86400)*1000).toISOString().slice(0,10);return {day,visitors:result[4].results.find(d=>d.day===day)?.visitors||0};});
 return {generatedAt:now,summary,players,rounds:result[2].results,visits:result[3].results,daily};
}
export async function handleApi(request,db,env={}){
 try{
  const url=new URL(request.url),path=url.pathname,now=Date.now()/1000;
  if(request.method==='GET'){
   if(path==='/api/bootstrap'){
    let p=cookie(request,'peach_player');
    if(!p||!await db.prepare('SELECT 1 FROM players WHERE id=?').bind(p).first()) {p=token();await db.prepare('INSERT INTO players(id,created,seen) VALUES(?,?,?)').bind(p,now,now).run();}
    const row=await db.prepare('SELECT revision,payload,updated FROM saves WHERE player=?').bind(p).first();
    return json({player:p.slice(0,8),revision:row?.revision||0,save:row?JSON.parse(row.payload):null,updatedAt:row?Math.round(row.updated*1000):0},200,setCookie('peach_player',p,31536000));
   }
   if(path==='/api/admin/stats'){await admin(request,db,now);return json(await report(db,now));}
   if(path==='/api/health') {await db.prepare('SELECT 1 FROM players LIMIT 1').first();return json({ok:true,storage:'cloud'});}
   return json({error:'Not found'},404);
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==url.origin)fail(403,'Same-origin request required');
  if(Number(request.headers.get('content-length'))>200000)fail(413,'Request too large');
  // Enforce the byte limit while streaming, including requests without Content-Length.
  const reader=request.body?.getReader();if(!reader)fail(400,'Empty body');let bytes=0,parts=[];
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>200000){await reader.cancel();fail(413,'Request too large');}parts.push(value);}
  const buffer=new Uint8Array(bytes);let offset=0;for(const part of parts){buffer.set(part,offset);offset+=part.byteLength;}
  let data;try{data=JSON.parse(new TextDecoder().decode(buffer));}catch{fail(400,'Invalid JSON');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid body');
  if(path==='/api/admin/login'){
   if(!env.ADMIN_PASSWORD_HASH)fail(503,'后台尚未配置');
   const key=await hash(request.headers.get('cf-connecting-ip')||'unknown'),window=Math.floor(now/60);
   const attempt=await db.prepare('INSERT INTO login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,attempts=CASE WHEN login_limits.window=excluded.window THEN login_limits.attempts+1 ELSE 1 END RETURNING attempts').bind(key,window).first();
   if(attempt.attempts>10)fail(429,'尝试过多，请一分钟后重试');
   if(typeof data.password!=='string'||data.password.length>200||await hash(data.password)!==env.ADMIN_PASSWORD_HASH)fail(401,'密码不正确');
   const t=token();await db.batch([db.prepare('DELETE FROM admins WHERE expires<?').bind(now),db.prepare('DELETE FROM login_limits WHERE window<?').bind(window-1440),db.prepare('INSERT INTO admins(token,expires) VALUES(?,?)').bind(await hash(t),now+43200)]);
   return json({ok:true},200,setCookie('peach_admin',t,43200,true));
  }
  if(path==='/api/admin/logout'){await db.prepare('DELETE FROM admins WHERE token=?').bind(await hash(cookie(request,'peach_admin'))).run();return json({ok:true},200,setCookie('peach_admin','',0,true));}
  const p=await player(request,db);
  if(path==='/api/save'){
   const v=data.save,revision=num(data.revision);if(!Number.isInteger(revision)||!v||typeof v!=='object'||!v.lab||typeof v.lab!=='object'||Array.isArray(v.lab))fail(400,'Invalid save');num(v.bank??0);num(v.level??0,3);
   const raw=JSON.stringify(v);if(new TextEncoder().encode(raw).length>150000)fail(400,'Save too large');
   // One conditional statement is atomic across concurrent Worker instances.
   const row=await db.prepare('INSERT INTO saves(player,revision,payload,updated) SELECT ?,1,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM saves WHERE player=? AND revision=?) ON CONFLICT(player) DO UPDATE SET revision=saves.revision+1,payload=excluded.payload,updated=excluded.updated WHERE saves.revision=? RETURNING revision').bind(p,raw,now,revision,p,revision,revision).first();
   if(!row){const current=await db.prepare('SELECT revision FROM saves WHERE player=?').bind(p).first();return json({conflict:true,revision:current?.revision||0},409);}return json(row);
  }
  if(path==='/api/visit'){
   const uid=id(data.id),elapsed=num(data.elapsed,31536000),ended=Number(!!data.ended);
   const old=await db.prepare('SELECT player FROM visits WHERE id=?').bind(uid).first();if(old&&old.player!==p)fail(403,'Forbidden');
   await db.batch([
    db.prepare('INSERT INTO visits(id,player,started,seen,elapsed,ended) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET seen=MAX(visits.seen,excluded.seen),elapsed=MAX(visits.elapsed,MIN(?,MAX(0,?-visits.started)+2)),ended=MAX(visits.ended,excluded.ended) WHERE visits.player=excluded.player AND visits.ended=0').bind(uid,p,now-Math.min(elapsed,120),now,Math.min(elapsed,120),ended,elapsed,now),
    db.prepare('UPDATE players SET seen=MAX(seen,?) WHERE id=?').bind(now,p)
   ]);return json({ok:true});
  }
  if(path==='/api/round'){
   const uid=id(data.id),duration=num(data.duration,31536000),total=num(data.total,8),caught=num(data.caught,8),delivered=num(data.delivered,8),escaped=num(data.escaped,8);
   if(!['playing','completed','abandoned'].includes(data.status)||![total,caught,delivered,escaped].every(Number.isInteger)||delivered>caught||caught+escaped>total)fail(400,'Invalid round');
   const old=await db.prepare('SELECT player FROM rounds WHERE id=?').bind(uid).first();if(old&&old.player!==p)fail(403,'Forbidden');
   await db.prepare('INSERT INTO rounds(id,player,started,updated,status,duration,caught,delivered,escaped,total,demo) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,duration=excluded.duration,caught=excluded.caught,delivered=excluded.delivered,escaped=excluded.escaped,total=excluded.total WHERE rounds.player=excluded.player AND rounds.status=\'playing\' AND rounds.duration<=excluded.duration').bind(uid,p,now,now,data.status,duration,caught,delivered,escaped,total,Number(!!data.demo)).run();return json({ok:true});
  }
  return json({error:'Not found'},404);
 }catch(e){if(e.status)return json({error:e.message},e.status);console.error('Game API unavailable',e.message);return json({error:'云端暂时不可用，请稍后重试；本机进度会保留'},503);}
}
