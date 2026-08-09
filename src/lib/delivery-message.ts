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
}) {
  return `🎉 PEDIDO APROVADO COM SUCESSO! 🎉

Olá! 👋

Seu pedido foi aprovado com sucesso! 💚

Muito obrigado pela sua compra e pela confiança em nosso produto. 🚀

Seu acesso já está disponível e sua licença foi gerada com sucesso.

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

🔐 Esta licença é individual.

⚠️ Não compartilhe sua licença com outras pessoas.

💻 O número de dispositivos permitidos depende do plano adquirido.

⏱️ O período de validade segue exatamente as condições do plano contratado.

━━━━━━━━━━━━━━━━━━

💚 PRECISA DE AJUDA?

Se tiver qualquer dificuldade para instalar, ativar ou utilizar a extensão, fique tranquilo! 😊

Entre em contato com nosso suporte.

Nossa equipe estará pronta para ajudar você. 🤝

━━━━━━━━━━━━━━━━━━

🎉 Obrigado pela confiança!

Esperamos que você aproveite ao máximo sua experiência. 🚀💚

Bom uso! 🔥`;
}

export function copyToClipboard(text: string, successMessage: string = "Copiado com sucesso!") {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(successMessage);
  }).catch(() => {
    toast.error("Erro ao copiar.");
  });
}
