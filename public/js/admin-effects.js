/* DTC Admin — professional page motion and appearance controls */
'use strict';
const AdminEffects=(()=>{
  let observer=null;
  const apply=(appearance)=>{
    const a=appearance || (Store.settings||{}).adminAppearance || {};
    const motion=['off','subtle','balanced','full'].includes(a.motion)?a.motion:'balanced';
    document.body.dataset.adminMotion=motion;
    document.body.classList.toggle('admin-glow',a.backgroundGlow!==false && motion!=='off');
    document.body.classList.toggle('admin-card-hover',a.cardHover!==false && motion!=='off');
    if(a.dataAnimations!==false && motion!=='off') animateVisible();
  };
  const animateVisible=()=>{
    document.querySelectorAll('.page.active .stat:not(.motion-pop)').forEach((el,i)=>{
      el.style.animationDelay=`${Math.min(i*45,280)}ms`; el.classList.add('motion-pop');
    });
    document.querySelectorAll('.page.active tbody tr:not(.motion-row)').forEach((el,i)=>{
      el.style.animationDelay=`${Math.min(i*22,260)}ms`; el.classList.add('motion-row');
    });
  };
  const pageChanged=()=>requestAnimationFrame(()=>{apply();animateVisible();});
  const init=()=>{
    apply();
    observer=new MutationObserver(m=>{
      if(m.some(x=>x.type==='attributes'||x.addedNodes.length)) pageChanged();
    });
    const main=document.querySelector('.main');
    if(main) observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  };
  return{init,apply,pageChanged};
})();
