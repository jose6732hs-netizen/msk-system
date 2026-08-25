import { toast } from "sonner";

export function generateDeliveryMessage(data: {
  productName: string;
  planName: string;
  planDuration: string;
  maxDevices: number | string;
  licenseKey: string;
  activationInfo: string;
  expirationInfo: string;
  licenseStatus: string;
  isTrial?: boolean;
}) {
  const header = data.isTrial
    ? `🎉 SEU TESTE GRATUITO FOI LIBERADO! 🎉

Olá! 👋

Sua licença de teste foi gerada com sucesso. O acesso ficará disponível somente durante o período informado abaixo.`
    : `🎉 PEDIDO APROVADO COM SUCESSO! 🎉

Olá! 👋

Seu pedido foi aprovado com sucesso! 💚

Muito obrigado pela sua compra e pela confiança em nosso produto. 🚀

Seu acesso já está disponível e sua licença foi gerada com sucesso.`;

  const closing = data.isTrial
    ? `🎉 Bom teste!

Ao terminar o período gratuito, escolha um plano pago para continuar utilizando a extensão.`
    : `🎉 Obrigado pela confiança!

Esperamos que você aproveite ao máximo sua experiência. 🚀💚

Bom uso! 🔥`;

  const important = data.isTrial
    ? `🔐 Esta licença de teste é individual.

⚠️ Não compartilhe sua licença com outras pessoas.

⏱️ O teste expira automaticamente ao final de ${data.planDuration}.

💻 Dispositivos permitidos durante o teste: ${data.maxDevices}.`
    : `🔐 Esta licença é individual.

⚠️ Não compartilhe sua licença com outras pessoas.

💻 O número de dispositivos permitidos depende do plano adquirido.

⏱️ O período de validade segue exatamente as condições do plano contratado.`;

  return `${header}

━━━━━━━━━━━━━━━━━━

🔐 SUA LICENÇA

${data.licenseKey}

━━━━━━━━━━━━━━━━━━

📦 DADOS DO SEU ACESSO

🛍️ Produto:
${data.productName}

⭐ Plano:
${data.planName}

⏱️ Validade:
${data.planDuration}

💻 Dispositivos permitidos:
${data.maxDevices}

📅 Ativação:
${data.activationInfo}

📆 Expiração:
${data.expirationInfo}

🟢 Status:
${data.licenseStatus}

━━━━━━━━━━━━━━━━━━

🚀 COMO ATIVAR

1️⃣ Instale a extensão.
2️⃣ Abra a extensão no Google Chrome.
3️⃣ Informe sua licença.
4️⃣ Clique em "Ativar licença".
5️⃣ Pronto! 🎉

Seu acesso será validado automaticamente.

━━━━━━━━━━━━━━━━━━

💡 IMPORTANTE

${important}

━━━━━━━━━━━━━━━━━━

💚 PRECISA DE AJUDA?

Se tiver qualquer dificuldade para instalar, ativar ou utilizar a extensão, entre em contato com nosso suporte.

━━━━━━━━━━━━━━━━━━

${closing}`;
}

export function copyToClipboard(text: string, successMessage: string = "Copiado com sucesso!") {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(successMessage);
    })
    .catch(() => {
      toast.error("Erro ao copiar.");
    });
}

export function generateSalesMessage(data: {
  productName: string;
  planName: string;
  planDuration: string;
  maxDevices: number | string;
  licenseKey: string;
  expirationInfo: string;
  isTrial?: boolean;
}) {
  const planText = String(data.planName ?? "").toLowerCase();
  const isTrial = data.isTrial === true || /free|teste|trial|gr[aá]tis/.test(planText);

  if (isTrial) {
    return `🎁 ${data.productName} — TESTE GRÁTIS LIBERADO 🎁

Olá! 👋 Seu acesso de teste foi liberado.

━━━━━━━━━━━━━━━━━━

⭐ PLANO: ${data.planName}
⏱️ Duração real: ${data.planDuration}
💻 Dispositivos liberados: ${data.maxDevices}
📆 Expira em: ${data.expirationInfo}

Este é um acesso temporário de demonstração. Ele não é uma compra, não é vitalício e será encerrado automaticamente quando o tempo acima terminar.

━━━━━━━━━━━━━━━━━━

🔐 SUA LICENÇA

${data.licenseKey}

━━━━━━━━━━━━━━━━━━

🚀 ATIVAÇÃO EM 3 PASSOS
1️⃣ Instale a extensão MSK SISTEM no Chrome.
2️⃣ Abra a extensão e cole a licença acima.
3️⃣ Clique em "Ativar licença".

⚠️ A licença é individual e o período gratuito não se transforma automaticamente em plano pago.

Bom teste! 🔥`;
  }

  return `🔥 ${data.productName} — ACESSO LIBERADO 🔥

Olá! 👋 Muito obrigado pela sua compra e pela confiança! 💚

Você acaba de garantir o plano *${data.planName}*, e abaixo está tudo o que ele inclui:

━━━━━━━━━━━━━━━━━━

⭐ SEU PLANO: ${data.planName}
⏱️ Duração: ${data.planDuration}
💻 Dispositivos liberados: ${data.maxDevices}
📆 Expira em: ${data.expirationInfo}
♾️ Recursos liberados enquanto a licença estiver ativa
🛡️ Suporte durante toda a vigência

━━━━━━━━━━━━━━━━━━

🔐 SUA LICENÇA

${data.licenseKey}

━━━━━━━━━━━━━━━━━━

🚀 ATIVAÇÃO EM 3 PASSOS
1️⃣ Instale a extensão MSK SISTEM no Chrome.
2️⃣ Abra a extensão e cole a licença acima.
3️⃣ Clique em "Ativar licença" e pronto! 🎉

⚠️ A licença é individual — não compartilhe.

Qualquer dúvida, é só chamar o suporte. Estamos com você! 🤝

Obrigado por fazer parte da MSK SISTEM. Bom uso! 🔥`;
}
