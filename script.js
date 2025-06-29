// ===== CONFIGURAÇÃO PIX =====
// ALTERE APENAS ESTA LINHA COM SUA CHAVE PIX PADRÃO:
const CHAVE_PIX_PADRAO = "00020126330014br.gov.bcb.pix0111117999919385204000053039865802BR5918Eduardo Sochodolak6009Sao Paulo62290525REC686149BB7FB407953688806304DD81";

// ===== VARIÁVEIS GLOBAIS =====
let qrCodeInstance = null;
let ultimoCodigoGerado = '';

// ===== FUNÇÕES PRINCIPAIS =====

/**
 * Detecta se é um código PIX copia e cola válido
 * @param {string} codigo - Código a ser analisado
 * @returns {boolean} - True se for código copia e cola válido
 */
function isCodigoCopiaECola(codigo) {
    if (!codigo || typeof codigo !== 'string') return false;
    
    const codigoClean = codigo.trim();
    
    // Verificar se é código PIX copia e cola
    return codigoClean.startsWith('0002') && 
           codigoClean.length > 100 && 
           codigoClean.includes('br.gov.bcb.pix');
}

/**
 * Calcula o CRC16 para validação do código PIX
 * Algoritmo exato conforme especificação do Banco Central
 * @param {string} str - String para calcular o CRC
 * @returns {string} - CRC16 em hexadecimal
 */
function calcularCRC16(str) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    
    crc = crc & 0xFFFF;
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera código PIX base a partir de uma chave PIX
 * @param {string} chavePix - Chave PIX (email, CPF, telefone, etc.)
 * @returns {string|null} - Código PIX base ou null se erro
 */
function gerarCodigoPixBase(chavePix) {
    try {
        const chaveClean = chavePix.trim();
        const tamanhoChave = chaveClean.length.toString().padStart(2, '0');
        
        // Estrutura básica do PIX
        let pixCode = '';
        
        // Payload Format Indicator (00) - Obrigatório
        pixCode += '000201';
        
        // Point of Initiation Method (01) - Estático para pagamento único
        pixCode += '010211';
        
        // Merchant Account Information (26) - Informações da conta
        const subCampo0 = '0014br.gov.bcb.pix'; // GUI do arranjo de pagamento
        const subCampo1 = `01${tamanhoChave}${chaveClean}`; // Chave PIX
        const merchantInfo = subCampo0 + subCampo1;
        const merchantSize = merchantInfo.length.toString().padStart(2, '0');
        pixCode += `26${merchantSize}${merchantInfo}`;
        
        // Merchant Category Code (52) - Categoria do comerciante
        pixCode += '52040000';
        
        // Transaction Currency (53) - Código da moeda (986 = BRL)
        pixCode += '5303986';
        
        // Country Code (58) - Código do país
        pixCode += '5802BR';
        
        // Merchant Name (59) - Nome do recebedor (opcional, mas recomendado)
        const nomeRecebedor = 'PIX';
        const tamanhoNome = nomeRecebedor.length.toString().padStart(2, '0');
        pixCode += `59${tamanhoNome}${nomeRecebedor}`;
        
        // Merchant City (60) - Cidade do recebedor (opcional, mas recomendado)
        const cidade = 'SAO PAULO';
        const tamanhoCidade = cidade.length.toString().padStart(2, '0');
        pixCode += `60${tamanhoCidade}${cidade}`;
        
        // CRC (63) - Será calculado depois
        pixCode += '6304';
        
        // Calcular e adicionar CRC
        const crc = calcularCRC16(pixCode);
        pixCode = pixCode.substring(0, pixCode.length - 4) + '6304' + crc;
        
        return pixCode;
        
    } catch (error) {
        console.error('❌ Erro ao gerar código PIX base:', error);
        return null;
    }
}

/**
 * Gera código PIX personalizado com valor específico
 * FUNCIONA APENAS COM CÓDIGOS COPIA E COLA
 * @param {string} codigoPix - Código PIX copia e cola
 * @param {number} valor - Valor em reais
 * @returns {string|null} - Código PIX válido ou null se erro
 */
function gerarCodigoPixComValor(codigoPix, valor) {
    console.log('🎯 Gerando PIX com valor:', valor);
    
    if (!valor || valor <= 0) {
        console.error('❌ Valor inválido:', valor);
        return null;
    }
    
    if (!isCodigoCopiaECola(codigoPix)) {
        console.error('❌ Este script funciona APENAS com códigos PIX copia e cola');
        mostrarStatus('❌ Cole um código PIX copia e cola válido no campo de chave!', 'error');
        return null;
    }
    
    try {
        console.log('📋 Processando código copia e cola...');
        console.log('📝 Código original:', codigoPix);
        
        // Formatar valor com 2 casas decimais
        const valorFormatado = valor.toFixed(2);
        const tamanhoValor = valorFormatado.length.toString().padStart(2, '0');
        
        // Construir campo de valor (ID 54)
        const campoValor = `54${tamanhoValor}${valorFormatado}`;
        console.log('💰 Campo valor a inserir:', campoValor);
        
        // Remover CRC do código (últimos 8 caracteres: 6304XXXX)
        const pixSemCrc = codigoPix.substring(0, codigoPix.length - 8);
        console.log('📝 PIX sem CRC:', pixSemCrc);
        
        // Procurar por Currency (53) e Country (58) para determinar onde inserir
        const indiceCurrency = pixSemCrc.indexOf('5303986'); // 53 + 03 + 986
        const indiceCountry = pixSemCrc.indexOf('5802BR');   // 58 + 02 + BR
        
        console.log('🔍 Posição Currency (5303986):', indiceCurrency);
        console.log('🔍 Posição Country (5802BR):', indiceCountry);
        
        if (indiceCurrency === -1) {
            throw new Error('Campo Currency (5303986) não encontrado no código PIX');
        }
        
        // Verificar se já existe valor (campo 54) e remover se existir
        let pixLimpo = pixSemCrc;
        const regexValor = /54\d{2}[\d.]+/;
        
        if (regexValor.test(pixSemCrc)) {
            console.log('⚠️ Removendo valor existente...');
            pixLimpo = pixSemCrc.replace(regexValor, '');
            console.log('🧹 PIX após remoção do valor:', pixLimpo);
        }
        
        // Encontrar a posição correta para inserir o valor
        // Deve ser após Currency (53) e antes de Country (58)
        const posCurrency = pixLimpo.indexOf('5303986');
        const posCountry = pixLimpo.indexOf('5802BR');
        
        if (posCurrency === -1 || posCountry === -1) {
            throw new Error('Não foi possível localizar campos Currency ou Country');
        }
        
        // Inserir valor após Currency (5303986) que tem 7 caracteres
        const posicaoInsercao = posCurrency + 7;
        
        const pixComValor = pixLimpo.substring(0, posicaoInsercao) + 
                           campoValor + 
                           pixLimpo.substring(posicaoInsercao);
        
        console.log('💳 PIX com valor inserido:', pixComValor);
        
        // Adicionar CRC temporário (6304) e calcular CRC final
        const pixComCrcTemp = pixComValor + '6304';
        const crc = calcularCRC16(pixComCrcTemp);
        const pixFinal = pixComCrcTemp + crc;
        
        console.log('✅ PIX final gerado:', pixFinal);
        console.log('📏 Tamanho final:', pixFinal.length, 'caracteres');
        
        // Validação final
        if (!pixFinal.startsWith('000201') || !pixFinal.includes('br.gov.bcb.pix')) {
            throw new Error('Código PIX gerado com estrutura inválida');
        }
        
        return pixFinal;
        
    } catch (error) {
        console.error('❌ Erro ao processar código PIX:', error);
        mostrarStatus('Erro ao processar código: ' + error.message, 'error');
        return null;
    }
}

/**
 * Gera QR Code a partir do código PIX
 * @param {string} codigoPix - Código PIX válido
 * @returns {boolean} - True se sucesso, false se erro
 */
function gerarQRCode(codigoPix) {
    try {
        const canvas = document.getElementById('qrcode');
        
        if (!canvas) {
            throw new Error('Canvas para QR Code não encontrado');
        }
        
        qrCodeInstance = new QRious({
            element: canvas,
            value: codigoPix,
            size: 280,
            level: 'M',
            foreground: '#1e3c72',
            background: '#ffffff'
        });
        
        console.log('✅ QR Code gerado com sucesso!');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error);
        mostrarStatus('Erro ao gerar QR Code: ' + error.message, 'error');
        return false;
    }
}

/**
 * Mostra mensagem de status para o usuário
 * @param {string} mensagem - Mensagem a ser exibida
 * @param {string} tipo - Tipo: 'success' ou 'error'
 */
function mostrarStatus(mensagem, tipo = 'success') {
    const statusDiv = document.getElementById('status');
    
    if (!statusDiv) return;
    
    statusDiv.className = `status ${tipo}`;
    statusDiv.textContent = mensagem;
    statusDiv.style.display = 'block';
    
    // Auto-ocultar mensagens de sucesso após 4 segundos
    if (tipo === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);
    }
}

/**
 * Função principal - gera PIX completo com QR Code
 * FUNCIONA APENAS COM CÓDIGOS COPIA E COLA
 */
function gerarPixCompleto() {
    const valorInput = document.getElementById('valor');
    const chaveInput = document.getElementById('chavePix') || { value: CHAVE_PIX_PADRAO };
    const gerarBtn = document.getElementById('gerarBtn');
    
    const valor = parseFloat(valorInput.value);
    const codigoPix = chaveInput.value.trim();
    
    // Validação de entrada
    if (!valor || valor <= 0) {
        mostrarStatus('Por favor, insira um valor válido maior que zero!', 'error');
        valorInput.focus();
        return;
    }
    
    if (!codigoPix) {
        mostrarStatus('Por favor, cole um código PIX copia e cola!', 'error');
        if (chaveInput.focus) chaveInput.focus();
        return;
    }
    
    // Validar se é código copia e cola
    if (!isCodigoCopiaECola(codigoPix)) {
        mostrarStatus('❌ Este gerador funciona APENAS com códigos PIX copia e cola! Cole um código válido.', 'error');
        if (chaveInput.focus) chaveInput.focus();
        return;
    }
    
    // Estado de loading
    gerarBtn.disabled = true;
    gerarBtn.textContent = '⏳ Gerando...';
    gerarBtn.classList.add('loading');
    
    // Pequeno delay para melhor UX
    setTimeout(() => {
        try {
            // Gerar código PIX personalizado
            const codigoPersonalizado = gerarCodigoPixComValor(codigoPix, valor);
            
            if (!codigoPersonalizado) {
                throw new Error('Falha ao gerar código PIX válido');
            }
            
            // Salvar código gerado
            ultimoCodigoGerado = codigoPersonalizado;
            
            // Exibir código na interface
            const pixCodeElement = document.getElementById('codigoPix');
            if (pixCodeElement) {
                pixCodeElement.textContent = codigoPersonalizado;
            }
            
            // Gerar QR Code
            if (!gerarQRCode(codigoPersonalizado)) {
                throw new Error('Falha ao gerar QR Code');
            }
            
            // Mostrar informações do código
            const infoChaveElement = document.getElementById('infoChave');
            if (infoChaveElement) {
                infoChaveElement.innerHTML = `
                    <strong>Tipo:</strong> Código Copia e Cola<br>
                    <strong>Valor:</strong> R$ ${valor.toFixed(2).replace('.', ',')}
                `;
            }
            
            // Tentar copiar automaticamente
            if (navigator.clipboard) {
                navigator.clipboard.writeText(codigoPersonalizado).then(() => {
                    mostrarStatus(`✅ PIX de R$ ${valor.toFixed(2).replace('.', ',')} gerado e copiado automaticamente!`);
                }).catch(() => {
                    mostrarStatus(`✅ PIX de R$ ${valor.toFixed(2).replace('.', ',')} gerado com sucesso!`);
                });
            } else {
                mostrarStatus(`✅ PIX de R$ ${valor.toFixed(2).replace('.', ',')} gerado com sucesso!`);
            }
            
            // Mostrar resultado
            const resultadoDiv = document.getElementById('resultado');
            if (resultadoDiv) {
                resultadoDiv.classList.add('show');
                
                // Scroll suave para o resultado
                resultadoDiv.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
            }
            
        } catch (error) {
            console.error('❌ Erro geral:', error);
            mostrarStatus('Erro ao gerar PIX: ' + error.message, 'error');
        } finally {
            // Restaurar estado do botão
            gerarBtn.disabled = false;
            gerarBtn.textContent = '🎯 Gerar PIX + QR Code';
            gerarBtn.classList.remove('loading');
        }
    }, 500);
}

/**
 * Copia código PIX para área de transferência
 */
function copiarCodigo() {
    if (!ultimoCodigoGerado) {
        mostrarStatus('Nenhum código PIX foi gerado ainda!', 'error');
        return;
    }
    
    const botao = event.target;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(ultimoCodigoGerado).then(() => {
            // Feedback visual
            const textoOriginal = botao.textContent;
            botao.textContent = '✅ Copiado!';
            botao.classList.add('copied');
            
            setTimeout(() => {
                botao.textContent = textoOriginal;
                botao.classList.remove('copied');
            }, 2000);
            
            mostrarStatus('📋 Código PIX copiado para área de transferência!');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            mostrarStatus('Erro ao copiar. Tente selecionar o texto manualmente.', 'error');
        });
    } else {
        // Fallback para navegadores mais antigos
        mostrarStatus('Selecione e copie o código manualmente (Ctrl+C)', 'error');
        
        // Tentar selecionar o texto
        const pixCodeElement = document.getElementById('codigoPix');
        if (pixCodeElement) {
            const range = document.createRange();
            range.selectNode(pixCodeElement);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }
    }
}

/**
 * Baixa QR Code como imagem PNG
 */
function baixarQRCode() {
    if (!qrCodeInstance) {
        mostrarStatus('Nenhum QR Code foi gerado ainda!', 'error');
        return;
    }
    
    try {
        const canvas = document.getElementById('qrcode');
        
        if (!canvas) {
            throw new Error('Canvas do QR Code não encontrado');
        }
        
        // Criar link de download
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        link.download = `PIX-QRCode-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        mostrarStatus('💾 QR Code baixado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao baixar QR Code:', error);
        mostrarStatus('Erro ao baixar QR Code: ' + error.message, 'error');
    }
}

/**
 * Limpa resultados quando valor é alterado
 */
function limparResultados() {
    const resultado = document.getElementById('resultado');
    if (resultado && resultado.classList.contains('show')) {
        resultado.classList.remove('show');
        ultimoCodigoGerado = '';
        qrCodeInstance = null;
        
        // Limpar status
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }
}

/**
 * Preenche automaticamente com chave padrão
 */
function usarChavePadrao() {
    const chaveInput = document.getElementById('chavePix');
    if (chaveInput) {
        chaveInput.value = CHAVE_PIX_PADRAO;
        limparResultados();
    }
}

// ===== INICIALIZAÇÃO =====

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Gerador PIX carregado!');
    
    // Referencias dos elementos
    const valorInput = document.getElementById('valor');
    const chaveInput = document.getElementById('chavePix');
    const gerarBtn = document.getElementById('gerarBtn');
    
    // Auto-focus no campo de valor
    if (valorInput) {
        valorInput.focus();
        
        // Limpar resultados ao alterar valor
        valorInput.addEventListener('input', limparResultados);
        
        // Permitir gerar com Enter
        valorInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                gerarPixCompleto();
            }
        });
    }
    
    // Event listeners do campo chave PIX
    if (chaveInput) {
        // Preencher com chave padrão inicialmente
        chaveInput.value = CHAVE_PIX_PADRAO;
        
        // Limpar resultados ao alterar chave
        chaveInput.addEventListener('input', limparResultados);
        
        // Permitir gerar com Enter
        chaveInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                gerarPixCompleto();
            }
        });
    }
    
    // Event listener do botão principal
    if (gerarBtn) {
        gerarBtn.addEventListener('click', gerarPixCompleto);
    }
    
    // Verificar se biblioteca QR Code está carregada
    if (typeof QRious === 'undefined') {
        console.error('❌ Biblioteca QRious não carregada!');
        mostrarStatus('Erro: Biblioteca QR Code não carregada. Verifique sua conexão.', 'error');
    }
});

// ===== FUNÇÕES UTILITÁRIAS =====

/**
 * Formata valor para exibição em Real brasileiro
 * @param {number} valor - Valor numérico
 * @returns {string} - Valor formatado
 */
function formatarReal(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

/**
 * Valida se uma string é um código PIX válido
 * @param {string} codigo - Código PIX
 * @returns {boolean} - True se válido
 */
function validarCodigoPix(codigo) {
    if (!codigo || typeof codigo !== 'string') return false;
    
    // Código PIX deve ter pelo menos 40 caracteres
    if (codigo.length < 40) return false;
    
    // Deve começar com '0002'
    if (!codigo.startsWith('0002')) return false;
    
    return true;
}

// ===== TRATAMENTO DE ERROS GLOBAIS =====

window.addEventListener('error', function(e) {
    console.error('❌ Erro global capturado:', e.error);
    mostrarStatus('Ocorreu um erro inesperado. Recarregue a página e tente novamente.', 'error');
});

// ===== DEBUG (remover em produção) =====

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 Modo debug ativo');
    window.debugPix = {
        gerarCodigo: gerarCodigoPixComValor,
        gerarBase: gerarCodigoPixBase,
        detectarTipo: detectarTipoChave,
        calcularCRC: calcularCRC16,
        validarCodigo: validarCodigoPix,
        chavePadrao: CHAVE_PIX_PADRAO
    };
}