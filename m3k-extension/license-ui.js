(function(){
  const API='https://msk-extencsoes.lovable.app/api/public/license';
  let busy=false;
  const $=id=>document.getElementById(id);
  const tokenEl=$('token'), activate=$('activate'), support=$('support'), status=$('status'), error=$('error');

  function send(message){
    return new Promise(resolve=>{
      chrome.runtime.sendMessage(message,r=>resolve(r||{success:false,error:'Sem resposta do serviço de licença.'}));
    });
  }
  function setError(v){error.textContent=v||'';}
  function setStatus(v,ok=false){status.textContent=v||'';status.className='status'+(ok?' success':'');}
  function normalize(v){return String(v||'').trim().toUpperCase();}

  async function activateLicense(){
    if(busy) return;
    const token=normalize(tokenEl.value);
    setError('');setStatus('');
    if(!/^MSK-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(token)){
      setError('Digite um token no formato MSK-XXXX-XXXX-XXXX-XXXX.');
      tokenEl.focus(); return;
    }
    busy=true; activate.disabled=true; setStatus('Validando licença...');
    try{
      const r=await send({action:'licenseActivate',token});
      if(!r.success) throw new Error(r.error||'Token inválido ou licença não autorizada.');
      setStatus('LICENÇA VALIDADA. ATUALIZANDO A PÁGINA...',true);

      // A ativação já foi persistida pelo service worker. Agora pedimos ao
      // service worker para recarregar a aba do Lovable que originou esta tela.
      // O usuário poderá então usar o menu Extensões → MSK SISTEM, como indicado
      // no card, para abrir o painel original.
      const reloadResult=await send({action:'licenseOpenExtension'});
      if(!reloadResult?.success){
        throw new Error(reloadResult?.error||'Licença validada, mas não foi possível atualizar a página do Lovable.');
      }
      setStatus('LICENÇA VALIDADA. AGUARDE A PÁGINA TERMINAR DE ATUALIZAR.',true);
      setTimeout(()=>window.close(),650);
    }catch(e){
      setStatus('');setError(e.message||'Não foi possível ativar a licença.');
      activate.disabled=false;busy=false;
    }
  }

  activate.addEventListener('click',activateLicense);
  tokenEl.addEventListener('keydown',e=>{if(e.key==='Enter')activateLicense();});
  tokenEl.addEventListener('input',()=>{tokenEl.value=normalize(tokenEl.value);});
  support.addEventListener('click',async()=>{
    const r=await send({action:'openSupport'});
    if(!r.success) setError(r.error||'O suporte por WhatsApp ainda não foi configurado.');
  });

  (async()=>{
    const r=await send({action:'licenseStatus'});
    if(r.success){
      setStatus('LICENÇA ATIVA. CLIQUE NO ÍCONE DO MSK SISTEM PARA ABRIR.',true);
      setTimeout(()=>window.close(),700);
    }else tokenEl.focus();
  })();
})();
