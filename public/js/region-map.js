/* DTC Admin — animated customer region map */
'use strict';
const RegionMap=(()=>{
  let data=null;
  const xy=(lat,lng)=>({x:((Number(lng)+180)/360)*1000,y:((90-Number(lat))/180)*500});
  const land=()=>`<g aria-hidden="true">
    <path class="world-land" d="M86 121 133 78 213 67 275 94 292 133 260 167 224 171 204 208 161 202 131 164 93 158Z"/>
    <path class="world-land" d="M240 218 286 235 309 282 297 345 273 407 248 364 251 313 223 267Z"/>
    <path class="world-land" d="M430 104 472 80 531 88 551 112 522 133 487 130 460 153 429 142Z"/>
    <path class="world-land" d="M465 157 525 148 574 177 595 230 579 299 543 362 500 335 487 275 451 226Z"/>
    <path class="world-land" d="M535 99 621 73 723 84 818 111 894 145 889 194 835 207 793 188 749 219 687 204 651 167 592 157 552 130Z"/>
    <path class="world-land" d="M797 301 853 286 906 313 897 357 851 373 810 345Z"/>
    <path class="world-land" d="M914 375 938 364 949 388 931 403Z"/>
    ${[100,200,300,400].map(y=>`<line class="world-line" x1="35" y1="${y}" x2="965" y2="${y}"/>`).join('')}
    ${[200,400,600,800].map(x=>`<line class="world-line" x1="${x}" y1="35" x2="${x}" y2="465"/>`).join('')}
  </g>`;
  const marker=(c,i)=>{
    const p=xy(c.lat,c.lng); const r=Math.max(8,Math.min(15,7+Math.sqrt(c.count)*2));
    return `<g class="map-marker" style="animation-delay:${Math.min(i*70,700)}ms" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" onclick="RegionMap.focusCountry(decodeURIComponent('${encodeURIComponent(c.country)}'))"><title>${esc(c.country)} — ${c.count} customer${c.count===1?'':'s'}</title><circle class="pulse" r="7"/><circle class="dot" r="${r}"/><text class="count" y=".5">${c.count}</text></g>`;
  };
  const render=()=>{
    const root=document.getElementById('region-map-card'); if(!root||!data)return;
    const assigned=document.getElementById('region-assigned'); const countries=document.getElementById('region-countries'); const unassigned=document.getElementById('region-unassigned');
    if(assigned)assigned.textContent=data.assigned||0;if(countries)countries.textContent=(data.countries||[]).length;if(unassigned)unassigned.textContent=data.unassigned||0;
    const svg=document.getElementById('region-world-svg');
    const mapped=(data.countries||[]).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng));
    svg.innerHTML=land()+mapped.map(marker).join('');
    const list=document.getElementById('region-list');
    if(!(data.countries||[]).length){list.innerHTML='<div class="region-empty">No customer locations are assigned yet. Open a customer profile and add country, region and city to populate the map.</div>';return;}
    const max=Math.max(...data.countries.map(c=>c.count),1);
    list.innerHTML=data.countries.map(c=>`<div class="region-item" onclick="RegionMap.focusCountry(decodeURIComponent('${encodeURIComponent(c.country)}'))"><div class="region-item-top"><span>${esc(c.country)}</span><span>${c.count}</span></div><div class="region-item-sub">${c.active} active${c.region?' · '+esc(c.region):''}${c.lat==null?' · map point unavailable':''}</div><div class="region-bar"><span style="width:${Math.max(7,c.count/max*100)}%"></span></div></div>`).join('');
  };
  const load=async()=>{
    const root=document.getElementById('region-map-card'); if(!root||!Store.adminKey)return;
    root.classList.add('loading');
    const d=await api(`/admin/customer-regions?adminKey=${encodeURIComponent(Store.adminKey)}`);
    root.classList.remove('loading');
    if(!d||d.error)return; data=d; render();
  };
  const focusCountry=(country)=>{
    if(!data)return; const c=(data.countries||[]).find(x=>x.country===country); if(!c)return;
    const detail=document.getElementById('region-focus');
    if(detail)detail.innerHTML=`<strong>${esc(c.country)}</strong> · ${c.count} customers · ${c.active} active${c.region?' · '+esc(c.region):''}`;
    document.querySelectorAll('.map-marker').forEach(m=>m.style.opacity='1');
  };
  return{load,render,focusCountry};
})();
