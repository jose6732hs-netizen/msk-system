async function requestMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Parar as faixas imediatamente para não ficar com a bolinha vermelha gravando à toa
        stream.getTracks().forEach(track => track.stop());

        // Avisa a extensão que a permissão foi concedida (opcional, mas bom para sincronia)
        chrome.runtime.sendMessage({ action: "microphone_permission_granted" });
        
        // Fecha a janela
        window.close();
    } catch (err) {
        console.error("Permissão de microfone negada:", err);
    }
}

document.getElementById('requestBtn').addEventListener('click', requestMic);

// Tentar pedir automaticamente ao carregar
requestMic();