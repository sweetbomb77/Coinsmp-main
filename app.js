const API_BASE=String(window.COINSMP_API_BASE||'').trim().replace(/\/$/,'');
const API=API_BASE?`${API_BASE}/api/stats`:'/api/stats';
const $=id=>document.getElementById(id);
const TEAM_ORDER=['red','blue','yellow','green'];
const TEAM_COLORS={red:'#d76d65',blue:'#6397c5',yellow:'#cfb04c',green:'#66a06b'};
let currentPlayers=[];
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(value)||0);
const number=value=>new Intl.NumberFormat('en-GB').format(Number(value)||0);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assignedTeam(player){const team=String(player.team??'').trim();return team&&team.toLowerCase()!=='none'&&team.toLowerCase()!=='no team'?team:null}
function renderStats(data){
  currentPlayers=(Array.isArray(data.players)?data.players:[]).filter(p=>assignedTeam(p));
  const sum=key=>currentPlayers.reduce((total,p)=>total+(Number(p[key])||0),0);
  $('onlineCount').textContent=number(currentPlayers.filter(p=>p.online).length);
  $('playerCount').textContent=number(currentPlayers.length);
  $('totalBalance').textContent=money(sum('balance'));
  $('totalDeaths').textContent=number(sum('deaths'));
  $('totalKills').textContent=number(sum('kills'));
  $('totalCaptures').textContent=number(sum('capturePointsGrabbed'));
  $('heroOnline').textContent=number(currentPlayers.filter(p=>p.online).length);
  $('heroUpdated').textContent=new Date(Number(data.timestamp)||Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  renderTeams(currentPlayers,Array.isArray(data.teams)?data.teams:[]);
  renderAllPlayers(currentPlayers);
}
function renderTeams(players,apiTeams){
  const names=new Map(TEAM_ORDER.map((name,index)=>[name,{name,color:TEAM_COLORS[name],index}]));
  [...apiTeams.map(t=>String(t.team||'').trim()),...players.map(assignedTeam)].filter(name=>name&&name.toLowerCase()!=='none'&&name.toLowerCase()!=='no team').forEach(name=>{const key=name.toLowerCase();if(!names.has(key))names.set(key,{name,color:'#879487',index:names.size})});
  $('teamGrid').innerHTML=[...names.entries()].map(([key,meta])=>{
    const roster=players.filter(p=>assignedTeam(p)?.toLowerCase()===key).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'}));
    const sum=field=>roster.reduce((total,p)=>total+(Number(p[field])||0),0);
    const rosterHtml=roster.length?`<div class="roster"><div class="roster-heading"><span>PLAYER</span><span>TIER</span><span class="num">BALANCE</span><span class="num">KILLS</span><span class="num">DEATHS</span><span class="num">CAPTURES</span></div>${roster.map(p=>{const tier=String(p.tier||'').toUpperCase()==='NONE'?'—':p.tier||'—';return `<div class="player-row"><span class="player-name" title="${esc(p.name)}"><i class="online-dot ${p.online?'is-online':''}" title="${p.online?'Online':'Offline'}"></i>${esc(p.name||'Unknown')}</span><span class="player-tier">${esc(tier)}</span><span class="num">${money(p.balance)}</span><span class="num">${number(p.kills)}</span><span class="num">${number(p.deaths)}</span><span class="num">${number(p.capturePointsGrabbed)}</span></div>`}).join('')}</div>`:'<div class="empty-roster">No assigned players</div>';
    return `<article class="team-card" style="--team:${meta.color}"><div class="team-top"><div class="team-name-wrap"><span class="team-swatch"></span><span class="team-name">${esc(meta.name)}</span></div><span class="team-members">${number(roster.length)} ${roster.length===1?'PLAYER':'PLAYERS'}</span></div><div class="team-balance-label">COMBINED BALANCE</div><div class="team-balance">${money(sum('balance'))}</div><div class="team-metrics"><div class="team-metric"><b>${number(sum('kills'))}</b><span>KILLS</span></div><div class="team-metric"><b>${number(sum('deaths'))}</b><span>DEATHS</span></div><div class="team-metric"><b>${number(sum('capturePointsGrabbed'))}</b><span>CAPTURES</span></div></div>${rosterHtml}</article>`;
  }).join('');
}
function renderAllPlayers(players){
  const query=$('playerSearch').value.trim().toLowerCase();
  const rows=players.filter(p=>[p.name,p.team,p.tier].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>String(a.team||'').localeCompare(String(b.team||''))||String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'}));
  $('playerCountLabel').textContent=`${number(rows.length)} assigned ${rows.length===1?'player':'players'}`;
  $('allPlayerRows').innerHTML=rows.length?rows.map(p=>{
    const team=assignedTeam(p)||'';const key=team.toLowerCase();const color=TEAM_COLORS[key]||'#879487';const tier=String(p.tier||'').toUpperCase()==='NONE'?'—':p.tier||'—';
    return `<tr><td><span class="full-player-name"><i class="online-dot ${p.online?'is-online':''}" title="${p.online?'Online':'Offline'}"></i>${esc(p.name||'Unknown')}</span></td><td><span class="team-chip" style="--team:${color}">${esc(team)}</span></td><td><span class="tier-chip">${esc(tier)}</span></td><td class="money-cell">${money(p.balance)}</td><td>${number(p.kills)}</td><td>${number(p.deaths)}</td><td>${number(p.capturePointsGrabbed)}</td><td><span class="status-label ${p.online?'online':''}">${p.online?'ONLINE':'OFFLINE'}</span></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="table-empty">No assigned players match that search.</td></tr>';
}
function renderActivity(events){
  const labels={kill:'Kill',death:'Death',capture:'Point capture',capture_spawn:'Point spawned',gladiator_win:'Gladiator win',gladiator_start:'Match started',gladiator_draw:'Match draw'};
  const recent=[...events].sort((a,b)=>(Number(b.timestamp)||0)-(Number(a.timestamp)||0)).slice(0,10);
  $('activityStatus').textContent=recent.length?`${number(recent.length)} recent events`:'No recent activity';
  $('activityRows').innerHTML=recent.length?recent.map(event=>{
    const type=String(event.type||'other');const label=labels[type]||type.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
    const time=new Date(Number(event.timestamp)||Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    return `<article class="activity-row"><time>${time}</time><span class="activity-kind kind-${esc(type)}">${esc(label)}</span><span class="activity-message">${esc(event.message||label)}</span></article>`;
  }).join(''):'<div class="activity-empty">No recent activity.</div>';
}
async function refreshActivity(){
  try{const response=await fetch(API_BASE?`${API_BASE}/api/events`:'/api/events',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const events=await response.json();if(!Array.isArray(events))throw new Error('Unexpected response');renderActivity(events)}
  catch{$('activityStatus').textContent='Activity feed unavailable';$('activityRows').innerHTML='<div class="activity-empty">Could not load recent activity.</div>'}
}
async function refresh(){
  if(!API_BASE&&location.hostname.endsWith('github.io')){$('apiDot').classList.add('error');$('apiStatus').textContent='Configure the HTTPS API proxy in api-config.js';$('teamGrid').innerHTML='<div class="loading-card">GitHub Pages needs an HTTPS API proxy to load live server data.</div>';return}
  let data=null,lastError=null;
  try{const response=await fetch(API,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json()}catch(error){lastError=error}
  const dot=$('apiDot');
  if(!data){dot.classList.add('error');$('apiStatus').textContent=`Stats unavailable · ${lastError?.message||'no response'}`;$('teamGrid').innerHTML='<div class="loading-card">Live stats are temporarily unavailable.</div>';return}
  if(!Array.isArray(data.players)||!Array.isArray(data.teams)){dot.classList.add('error');$('apiStatus').textContent='Stats unavailable · unexpected response';$('teamGrid').innerHTML='<div class="loading-card">The API returned an unexpected response.</div>';return}
  renderStats(data);dot.classList.remove('error');$('apiStatus').textContent='Updated every 5 seconds';
}
$('menuToggle').addEventListener('click',()=>{const open=$('navLinks').classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));$('menuToggle').setAttribute('aria-label',open?'Close navigation':'Open navigation')});
document.querySelectorAll('#navLinks a').forEach(link=>link.addEventListener('click',()=>{$('navLinks').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false')}));
$('playerSearch').addEventListener('input',()=>renderAllPlayers(currentPlayers));
refresh();setInterval(refresh,5000);
refreshActivity();setInterval(refreshActivity,5000);
