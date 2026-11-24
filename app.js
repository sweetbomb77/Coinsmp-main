const API_BASE=String(window.COINSMP_API_BASE||'').trim().replace(/\/$/,'');
const API=API_BASE?`${API_BASE}/api/stats`:'/api/stats';
const $=id=>document.getElementById(id);
const TEAM_ORDER=['red','blue','yellow','green'];
const TEAM_COLORS={red:'#d76d65',blue:'#6397c5',yellow:'#cfb04c',green:'#66a06b'};
let currentPlayers=[];
let currentEvents=[];
let expandedPlayers=new Set();
let previousBalances=new Map();
let observedGains=[];
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(value)||0);
const number=value=>new Intl.NumberFormat('en-GB').format(Number(value)||0);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assignedTeam(player){const team=String(player.team??'').trim();return team&&team.toLowerCase()!=='none'&&team.toLowerCase()!=='no team'?team:null}
function renderStats(data){
  const allPlayers=Array.isArray(data.players)?data.players:[];
  observeBalanceIncreases(allPlayers);
  currentPlayers=allPlayers.filter(p=>assignedTeam(p));
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
  renderActivity(currentEvents);
}
function observeBalanceIncreases(players){
  const now=Date.now();
  for(const player of players){
    const id=String(player.uuid||player.name||'');
    if(!id)continue;
    const balance=Number(player.balance)||0;
    const team=assignedTeam(player);
    const previous=previousBalances.get(id);
    if(previous&&team&&previous.team&&balance-previous.balance>0.004){
      observedGains.unshift({id,name:String(player.name||'Unknown'),team,amount:balance-previous.balance,timestamp:now,type:'balance_gain'});
      observedGains=observedGains.slice(0,50);
    }
    previousBalances.set(id,{balance,team,name:String(player.name||'Unknown')});
  }
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
    const id=String(p.uuid||p.name||'');const open=expandedPlayers.has(id);
    const details=open?`<tr class="player-detail-row"><td colspan="8">${playerDetails(p)}</td></tr>`:'';
    return `<tr class="player-summary-row"><td><button class="player-toggle" type="button" data-player-id="${esc(id)}" aria-expanded="${open}" style="--team:${color}"><span class="expand-caret">${open?'▾':'▸'}</span><i class="online-dot ${p.online?'is-online':''}" title="${p.online?'Online':'Offline'}"></i>${esc(p.name||'Unknown')}</button></td><td><span class="team-chip" style="--team:${color}">${esc(team)}</span></td><td><span class="tier-chip">${esc(tier)}</span></td><td class="money-cell">${money(p.balance)}</td><td>${number(p.kills)}</td><td>${number(p.deaths)}</td><td>${number(p.capturePointsGrabbed)}</td><td><span class="status-label ${p.online?'online':''}">${p.online?'ONLINE':'OFFLINE'}</span></td></tr>${details}`;
  }).join(''):'<tr><td colspan="8" class="table-empty">No assigned players match that search.</td></tr>';
}
function playerDetails(player){
  const name=String(player.name||'Unknown');
  const team=assignedTeam(player)||'';
  const id=String(player.uuid||name);
  const teamColor=TEAM_COLORS[team.toLowerCase()]||'#879487';
  const playerEvents=[];
  for(const event of currentEvents){
    const type=String(event.type||'');
    const message=String(event.message||'');
    if(type==='kill'){
      const match=message.match(/^([A-Za-z0-9_]{1,16})\s+eliminated\s+([A-Za-z0-9_]{1,16})$/i);
      if(!match||match[1].toLowerCase()!==name.toLowerCase())continue;
      const victim=currentPlayers.find(p=>String(p.name||'').toLowerCase()===match[2].toLowerCase());
      if(!victim||!assignedTeam(victim))continue;
      const victimTeam=assignedTeam(victim);const victimColor=TEAM_COLORS[victimTeam.toLowerCase()]||'#879487';
      playerEvents.push({timestamp:Number(event.timestamp)||0,html:`Eliminated <b style="color:${victimColor}">${esc(victim.name)}</b> <span class="detail-muted">(${esc(victimTeam)} team)</span>`});
    }else if(type==='capture'){
      const match=message.match(/^([A-Za-z0-9_]{1,16})\s+captured\s+(.+)$/i);
      if(match&&match[1].toLowerCase()===name.toLowerCase())playerEvents.push({timestamp:Number(event.timestamp)||0,html:`Captured <b>Point ${esc(match[2].replace(/^Point\s+/i,''))}</b>`});
    }else if(type==='gladiator_win'&&message.match(/^([A-Za-z0-9_]{1,16})\s+won\b/i)?.[1]?.toLowerCase()===name.toLowerCase()){
      playerEvents.push({timestamp:Number(event.timestamp)||0,html:'Won a Gladiators match'});
    }
  }
  const gains=observedGains.filter(g=>g.id===id).map(g=>({timestamp:g.timestamp,html:`Balance increased by <b class="gain-amount">${money(g.amount)}</b> <span class="detail-muted">(observed while this page was open)</span>`}));
  const history=[...playerEvents,...gains].sort((a,b)=>b.timestamp-a.timestamp).slice(0,15);
  const historyHtml=history.length?history.map(item=>`<li><time>${formatDate(item.timestamp)}</time><span>${item.html}</span></li>`).join(''):'<li class="detail-empty">No recent team activity recorded for this player.</li>';
  const tier=String(player.tier||'').toUpperCase()==='NONE'?'—':player.tier||'—';
  return `<div class="player-detail" style="--team:${teamColor}"><div class="player-detail-heading"><b style="color:${teamColor}">${esc(name)}</b><span>${esc(team)} team · Tier ${esc(tier)}</span></div><div class="player-detail-stats"><div><small>CURRENT BALANCE</small><b>${money(player.balance)}</b></div><div><small>KILLS</small><b>${number(player.kills)}</b></div><div><small>DEATHS</small><b>${number(player.deaths)}</b></div><div><small>POINT CAPTURES</small><b>${number(player.capturePointsGrabbed)}</b></div><div><small>STATUS</small><b>${player.online?'ONLINE':'OFFLINE'}</b></div></div><h3>Recent player activity</h3><ul class="player-history">${historyHtml}</ul><p class="earnings-note">The API has no historical payout ledger. Balance increases shown here are observed between live refreshes while this page is open.</p></div>`;
}
function formatDate(timestamp){return new Date(Number(timestamp)||Date.now()).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function renderActivity(events){
  const playerByName=new Map(currentPlayers.map(player=>[String(player.name||'').toLowerCase(),player]));
  const teamByName=new Map(currentPlayers.map(player=>[String(assignedTeam(player)||'').toLowerCase(),assignedTeam(player)]));
  const visible=[];
  for(const event of events){
    const type=String(event.type||'');const message=String(event.message||'');const timestamp=Number(event.timestamp)||0;
    if(type==='kill'){
      const match=message.match(/^([A-Za-z0-9_]{1,16})\s+eliminated\s+([A-Za-z0-9_]{1,16})$/i);
      if(!match)continue;
      const killer=playerByName.get(match[1].toLowerCase());const victim=playerByName.get(match[2].toLowerCase());
      if(!killer||!victim||!assignedTeam(killer)||!assignedTeam(victim)||String(killer.name).toLowerCase()===String(victim.name).toLowerCase())continue;
      const kc=TEAM_COLORS[assignedTeam(killer).toLowerCase()]||'#879487';const vc=TEAM_COLORS[assignedTeam(victim).toLowerCase()]||'#879487';
      visible.push({timestamp,kind:'PLAYER KILL',html:`<b style="color:${kc}">${esc(killer.name)}</b> eliminated <b style="color:${vc}">${esc(victim.name)}</b> <span class="activity-side">(${esc(assignedTeam(victim))})</span>`});
    }else if(type==='capture'){
      const match=message.match(/^([A-Za-z0-9_]{1,16})\s+captured\s+(.+)$/i);
      if(match){const player=playerByName.get(match[1].toLowerCase());if(!player||!assignedTeam(player))continue;const color=TEAM_COLORS[assignedTeam(player).toLowerCase()]||'#879487';visible.push({timestamp,kind:'POINT CAPTURE',html:`<b style="color:${color}">${esc(player.name)}</b> captured <b>Point ${esc(match[2].replace(/^Point\s+/i,''))}</b>`});continue}
      const teamMatch=[...teamByName.keys()].filter(Boolean).sort((a,b)=>b.length-a.length).find(team=>message.toLowerCase().startsWith(`${team} captured `));
      if(teamMatch){const team=teamByName.get(teamMatch);const color=TEAM_COLORS[team.toLowerCase()]||'#879487';const point=message.slice(team.length+' captured '.length).replace(/^Point\s+/i,'');visible.push({timestamp,kind:'TEAM CAPTURE',html:`<b style="color:${color}">${esc(team)}</b> captured <b>Point ${esc(point)}</b>`})}
    }else if(type==='gladiator_win'){
      const match=message.match(/^([A-Za-z0-9_]{1,16})\s+won\b/i);if(!match)continue;const winner=playerByName.get(match[1].toLowerCase());if(!winner||!assignedTeam(winner))continue;const color=TEAM_COLORS[assignedTeam(winner).toLowerCase()]||'#879487';visible.push({timestamp,kind:'GLADIATORS',html:`<b style="color:${color}">${esc(winner.name)}</b> won a Gladiators match`});
    }
  }
  for(const gain of observedGains){const player=currentPlayers.find(p=>String(p.uuid||p.name)===gain.id);if(!player||!assignedTeam(player))continue;const color=TEAM_COLORS[assignedTeam(player).toLowerCase()]||'#879487';visible.push({timestamp:gain.timestamp,kind:'BALANCE INCREASE',html:`<b style="color:${color}">${esc(player.name||gain.name)}</b> gained <b class="gain-amount">${money(gain.amount)}</b>`})}
  const recent=visible.sort((a,b)=>b.timestamp-a.timestamp).slice(0,3);
  $('activityStatus').textContent=recent.length?`${number(recent.length)} recent events`:'No recent activity';
  $('activityRows').innerHTML=recent.length?recent.map(event=>`<article class="activity-row"><time datetime="${new Date(event.timestamp||Date.now()).toISOString()}">${formatDate(event.timestamp)}</time><span class="activity-kind">${esc(event.kind)}</span><span class="activity-message">${event.html}</span></article>`).join(''):'<div class="activity-empty">No recent activity involving assigned-team players.</div>';
}
async function refreshActivity(){
  try{const response=await fetch(API_BASE?`${API_BASE}/api/events`:'/api/events',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const events=await response.json();if(!Array.isArray(events))throw new Error('Unexpected response');currentEvents=events;renderActivity(currentEvents);renderAllPlayers(currentPlayers)}
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
$('allPlayerRows').addEventListener('click',event=>{const button=event.target.closest('.player-toggle');if(!button)return;const id=button.dataset.playerId;if(expandedPlayers.has(id))expandedPlayers.delete(id);else expandedPlayers.add(id);renderAllPlayers(currentPlayers)});
refresh();setInterval(refresh,5000);
refreshActivity();setInterval(refreshActivity,5000);
