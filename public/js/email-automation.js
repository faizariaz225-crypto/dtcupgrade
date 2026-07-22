/* DTC Admin — automatic email and OTP control centre */
'use strict';
const EmailAutomation=(()=>{
  let automation=null,templates=[];
  const defaults={enabled:true,activation:{enabled:true,templateId:'welcome'},requestApproved:{enabled:true,templateId:'request-approved'},portalOtp:{enabled:true,templateId:'portal-otp',digits:6,expiryMinutes:15,resendSeconds:45,maxAttempts:5,sessionDays:30,magicLinkEnabled:true},expiryRules:[]};
  const opts=(selected)=>'<option value="">— Select template —</option>'+templates.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)}</option>`).join('');
  const fixedRow=(key,icon,name,desc,setting)=>`<div class="auto-map-row" data-auto-key="${key}"><div class="auto-map-icon">${icon}</div><div><div class="auto-map-name">${name}</div><div class="auto-map-desc">${desc}</div></div><select class="auto-template">${opts(setting.templateId)}</select><div class="auto-toggle-cell"><label class="toggle"><input class="auto-enabled" type="checkbox" ${setting.enabled!==false?'checked':''}/><div class="toggle-track"><div class="toggle-thumb"></div></div></label></div><div class="auto-actions"><button class="btn btn-outline btn-sm" onclick="EmailAutomation.editMapped(this)">Edit</button></div></div>`;
  const render=()=>{
    if(!automation)return;
    document.getElementById('auto-master').checked=automation.enabled!==false;
    const p=automation.portalOtp||defaults.portalOtp;
    ['digits','expiryMinutes','resendSeconds','maxAttempts','sessionDays'].forEach(k=>{const el=document.getElementById('auto-otp-'+k);if(el)el.value=p[k];});
    document.getElementById('auto-magic').checked=p.magicLinkEnabled!==false;
    document.getElementById('auto-fixed-list').innerHTML=
      fixedRow('portalOtp','🔐','Customer portal OTP','Verification code email and optional magic link.',p)+
      fixedRow('activation','✅','Activation confirmed','Sent when an administrator approves and activates a subscription.',automation.activation||defaults.activation)+
      fixedRow('requestApproved','🔗','Product request approved','Sent when a customer product request receives its activation link.',automation.requestApproved||defaults.requestApproved);
    renderRules(); renderSummary(); renderAppearance(); syncTestOptions();
  };
  const renderRules=()=>{
    const wrap=document.getElementById('auto-expiry-rules'); const rules=automation.expiryRules||[];
    wrap.innerHTML=rules.map((r,i)=>`<div class="expiry-rule-row" data-rule-index="${i}"><div class="auto-map-icon">${Number(r.daysBefore)===0?'⏱':'⏰'}</div><div><div class="expiry-rule-label">${Number(r.daysBefore)===0?'On expiry':'Days before'}</div><input class="rule-days" type="number" min="0" max="365" value="${Number(r.daysBefore)||0}" ${Number(r.daysBefore)===0?'title="0 means after expiry"':''}/></div><select class="rule-template">${opts(r.templateId)}</select><label class="toggle"><input class="rule-enabled" type="checkbox" ${r.enabled!==false?'checked':''}/><div class="toggle-track"><div class="toggle-thumb"></div></div></label><div class="expiry-rule-actions"><button class="btn btn-outline btn-sm" onclick="EmailAutomation.editRule(${i})">Edit</button><button class="btn btn-delete btn-sm" onclick="EmailAutomation.removeRule(${i})">Remove</button></div></div>`).join('')||'<div class="empty">No expiry rules configured.</div>';
  };
  const renderSummary=()=>{
    const rules=(automation.expiryRules||[]).filter(r=>r.enabled!==false);
    document.getElementById('auto-health-enabled').textContent=automation.enabled!==false?'Automation active':'Automation paused';
    document.getElementById('auto-health-otp').textContent=`OTP ${automation.portalOtp.digits} digits · ${automation.portalOtp.expiryMinutes} min`;
    document.getElementById('auto-health-rules').textContent=`${rules.length} expiry rule${rules.length===1?'':'s'}`;
  };
  const renderAppearance=()=>{
    const a=(Store.settings||{}).adminAppearance||{};
    const motion=document.getElementById('admin-motion-level'); if(motion)motion.value=a.motion||'balanced';
    ['cardHover','backgroundGlow','dataAnimations'].forEach(k=>{const el=document.getElementById('appearance-'+k);if(el)el.checked=a[k]!==false;});
  };
  const collect=()=>{
    const fixed={}; document.querySelectorAll('#auto-fixed-list .auto-map-row').forEach(row=>{fixed[row.dataset.autoKey]={enabled:row.querySelector('.auto-enabled').checked,templateId:row.querySelector('.auto-template').value};});
    const rules=[];document.querySelectorAll('#auto-expiry-rules .expiry-rule-row').forEach((row,i)=>rules.push({id:(automation.expiryRules[i]&&automation.expiryRules[i].id)||`rule-${Date.now()}-${i}`,enabled:row.querySelector('.rule-enabled').checked,daysBefore:Number(row.querySelector('.rule-days').value)||0,templateId:row.querySelector('.rule-template').value}));
    return{enabled:document.getElementById('auto-master').checked,activation:fixed.activation,requestApproved:fixed.requestApproved,portalOtp:{...fixed.portalOtp,digits:Number(document.getElementById('auto-otp-digits').value),expiryMinutes:Number(document.getElementById('auto-otp-expiryMinutes').value),resendSeconds:Number(document.getElementById('auto-otp-resendSeconds').value),maxAttempts:Number(document.getElementById('auto-otp-maxAttempts').value),sessionDays:Number(document.getElementById('auto-otp-sessionDays').value),magicLinkEnabled:document.getElementById('auto-magic').checked},expiryRules:rules};
  };
  const appearance=()=>({motion:document.getElementById('admin-motion-level').value,cardHover:document.getElementById('appearance-cardHover').checked,backgroundGlow:document.getElementById('appearance-backgroundGlow').checked,dataAnimations:document.getElementById('appearance-dataAnimations').checked});
  const load=async()=>{
    const d=await api(`/admin/email-automation?adminKey=${encodeURIComponent(Store.adminKey)}`);if(!d||d.error)return;
    automation={...defaults,...d.automation,portalOtp:{...defaults.portalOtp,...(d.automation.portalOtp||{})}};templates=d.templates||[];Store.setTemplates(templates);render();
  };
  const save=async()=>{
    automation=collect();const app=appearance();const d=await api('/admin/email-automation',{adminKey:Store.adminKey,automation,appearance:app});
    showMsg('auto-ok','auto-err',d&&d.success,d&&d.success?'✓ Automatic email, OTP and appearance settings saved.':(d&&d.error)||'Unable to save.');
    if(d&&d.success){Store.setSettings({...Store.settings,emailAutomation:d.automation,adminAppearance:d.appearance});AdminEffects.apply(d.appearance);automation=d.automation;renderSummary();}
  };
  const addRule=()=>{automation.expiryRules=automation.expiryRules||[];automation.expiryRules.push({id:'rule-'+Date.now(),enabled:true,daysBefore:7,templateId:'renewal-urgent'});renderRules();};
  const removeRule=i=>{automation.expiryRules.splice(i,1);renderRules();};
  const editTemplate=async id=>{if(!id)return alert('Select a template first.');await BulkEmail.loadTemplates();BulkEmail.editTemplate(id);};
  const editMapped=btn=>{const id=btn.closest('.auto-map-row')?.querySelector('.auto-template')?.value;editTemplate(id);};
  const editRule=i=>{const row=document.querySelector(`#auto-expiry-rules .expiry-rule-row[data-rule-index="${i}"]`);editTemplate(row?.querySelector('.rule-template')?.value);};
  const test=async templateId=>{const to=document.getElementById('auto-test-email').value.trim();if(!to)return showMsg('auto-ok','auto-err',false,'Enter a test email address.');const id=templateId||document.querySelector('#auto-fixed-list .auto-template')?.value;const d=await api('/admin/email-automation/test',{adminKey:Store.adminKey,to,templateId:id});showMsg('auto-ok','auto-err',d&&d.ok,d&&d.ok?'✓ Test email sent.':(d&&d.error)||'Test failed.');};
  const testSelected=()=>{const id=document.getElementById('auto-test-template').value;test(id);};
  const syncTestOptions=()=>{const sel=document.getElementById('auto-test-template');if(sel)sel.innerHTML=opts(sel.value);};
  return{load,save,addRule,removeRule,editTemplate,editMapped,editRule,testSelected,syncTestOptions};
})();
