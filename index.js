const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configurações
const CONFIG = {
    PORT: process.env.PORT || 3000,
    CARDAPIO_URL: process.env.CARDAPIO_URL || 'https://marcosgomes068.github.io/cardapioconcept/',
    SESSION_DIR: path.join(__dirname, '.wwebjs_auth'),
    LOG_DIR: path.join(__dirname, 'logs'),
    PEDIDO_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    MAX_PEDIDOS_POR_NUMERO: 3,
    CONTATO: '+55 68 9208-8865',
    STATUS_PEDIDO: {
        INICIADO: 'iniciado',
        CONFIRMADO: 'confirmado',
        EM_PREPARO: 'em_preparo',
        PRONTO: 'pronto',
        EM_ENTREGA: 'em_entrega',
        ENTREGUE: 'entregue',
        CANCELADO: 'cancelado',
        FINALIZADO: 'finalizado'
    }
};

// Criar diretório de logs se não existir
if (!fs.existsSync(CONFIG.LOG_DIR)) {
    fs.mkdirSync(CONFIG.LOG_DIR);
}

// Função para logging
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    // Log no console
    console.log(logMessage);
    
    // Log em arquivo
    const logFile = path.join(CONFIG.LOG_DIR, `${type}.log`);
    fs.appendFileSync(logFile, logMessage);
}

// Configuração do Express
const app = express();
app.use(cors());
app.use(express.json());

// Middleware de logging para API
app.use((req, res, next) => {
    log(`${req.method} ${req.url}`, 'api');
    next();
});

// Configuração do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "espetinhos-bot",
        dataPath: CONFIG.SESSION_DIR
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    },
    qrMaxRetries: 5,
    authTimeoutMs: 60000,
    restartOnAuthFail: true
});

// Armazenamento de pedidos em andamento
const pedidosEmAndamento = new Map();

// Função para gerar código único do pedido
function gerarCodigoPedido() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ESP${timestamp.slice(-6)}${random}`;
}

// Função para verificar timeout de pedidos
function verificarTimeoutPedidos() {
    const agora = Date.now();
    for (const [numero, pedido] of pedidosEmAndamento.entries()) {
        if (agora - pedido.timestamp > CONFIG.PEDIDO_TIMEOUT) {
            log(`Pedido ${pedido.codigo} expirado para ${numero}`, 'timeout');
            pedidosEmAndamento.delete(numero);
            client.sendMessage(numero, 
                '⚠️ *Aviso de Timeout*\n\n' +
                `Seu pedido ${pedido.codigo} expirou por inatividade.\n` +
                'Por favor, faça um novo pedido se desejar.'
            );
        }
    }
}

// Verificar timeout a cada 5 minutos
setInterval(verificarTimeoutPedidos, 5 * 60 * 1000);

// Evento para gerar QR Code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    log('QR Code gerado. Escaneie com seu WhatsApp.', 'auth');
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    log('Cliente WhatsApp conectado!', 'auth');
});

// Evento de desconexão
client.on('disconnected', (reason) => {
    log(`Cliente desconectado: ${reason}`, 'error');
});

// Evento de erro
client.on('auth_failure', (error) => {
    log(`Falha na autenticação: ${error}`, 'error');
});

// Função para processar comandos do pedido
async function processarComando(message, comando) {
    try {
        const numero = message.from;
        const pedido = pedidosEmAndamento.get(numero) || { status: CONFIG.STATUS_PEDIDO.INICIADO };

        switch (comando.toLowerCase()) {
            case 'confirmar':
                if (pedido.status === CONFIG.STATUS_PEDIDO.INICIADO) {
                    pedido.status = CONFIG.STATUS_PEDIDO.CONFIRMADO;
                    pedidosEmAndamento.set(numero, pedido);
                    log(`Pedido ${pedido.codigo} confirmado por ${numero}`, 'pedido');
                    await message.reply(
                        `✅ Pedido confirmado!\n` +
                        `Código do pedido: *${pedido.codigo}*\n\n` +
                        `Em breve você receberá uma mensagem quando o pedido estiver pronto para entrega.`
                    );
                } else {
                    await message.reply('❌ Este pedido já foi confirmado anteriormente.');
                }
                break;

            case 'cancelar':
                if (pedido.status !== CONFIG.STATUS_PEDIDO.FINALIZADO) {
                    pedido.status = CONFIG.STATUS_PEDIDO.CANCELADO;
                    log(`Pedido ${pedido.codigo} cancelado por ${numero}`, 'pedido');
                    pedidosEmAndamento.delete(numero);
                    await message.reply('❌ Pedido cancelado com sucesso.');
                } else {
                    await message.reply('❌ Não é possível cancelar um pedido já finalizado.');
                }
                break;

            case 'status':
                if (pedido.status) {
                    await message.reply(
                        `📊 *Status do Pedido*\n` +
                        `Código: *${pedido.codigo}*\n` +
                        `Status: ${pedido.status}`
                    );
                } else {
                    await message.reply('❌ Nenhum pedido encontrado para este número.');
                }
                break;

            case 'cardapio':
                await message.reply(
                    '🍖 *Nosso Cardápio* 🍖\n\n' +
                    `Acesse nosso cardápio digital: ${CONFIG.CARDAPIO_URL}\n\n` +
                    'Para fazer um pedido, copie os itens desejados e envie no formato:\n' +
                    '*PEDIDO - ESPETINHOS*\n' +
                    '[Seus itens aqui]\n\n' +
                    '📞 *Contato:* ' + CONFIG.CONTATO
                );
                break;

            case 'ajuda':
                await message.reply(
                    '📱 *Comandos Disponíveis*\n\n' +
                    '• /cardapio - Ver cardápio\n' +
                    '• /confirmar - Confirmar pedido\n' +
                    '• /cancelar - Cancelar pedido\n' +
                    '• /status - Verificar status\n' +
                    '• /ajuda - Ver esta mensagem\n\n' +
                    'Para fazer um pedido, envie:\n' +
                    '*PEDIDO - ESPETINHOS*\n' +
                    '[Seus itens aqui]'
                );
                break;

            default:
                await message.reply(
                    '❌ Comando não reconhecido.\n\n' +
                    'Comandos disponíveis:\n' +
                    '• /cardapio - Ver cardápio\n' +
                    '• /confirmar - Confirmar pedido\n' +
                    '• /cancelar - Cancelar pedido\n' +
                    '• /status - Verificar status\n' +
                    '• /ajuda - Ver ajuda\n\n' +
                    `Ou acesse nosso cardápio: ${CONFIG.CARDAPIO_URL}`
                );
        }
    } catch (error) {
        log(`Erro ao processar comando: ${error}`, 'error');
        await message.reply('❌ Ocorreu um erro ao processar o comando. Por favor, tente novamente.');
    }
}

// Função para processar pedido do site
async function processarPedidoSite(message) {
    try {
        const numero = message.from;
        
        // Verifica limite de pedidos
        const pedidosAtivos = Array.from(pedidosEmAndamento.values())
            .filter(p => p.numero === numero && p.status !== CONFIG.STATUS_PEDIDO.CANCELADO)
            .length;
            
        if (pedidosAtivos >= CONFIG.MAX_PEDIDOS_POR_NUMERO) {
            await message.reply(
                '❌ Você já tem o número máximo de pedidos ativos.\n' +
                'Por favor, aguarde a finalização de um pedido ou cancele um existente.'
            );
            return;
        }

        const codigo = gerarCodigoPedido();
        const pedido = {
            codigo: codigo,
            status: CONFIG.STATUS_PEDIDO.INICIADO,
            timestamp: Date.now(),
            mensagem: message.body,
            numero: numero
        };
        
        pedidosEmAndamento.set(numero, pedido);
        log(`Novo pedido ${codigo} recebido de ${numero}`, 'pedido');
        
        await message.reply(
            '🍖 *PEDIDO RECEBIDO!* 🍖\n\n' +
            `Código do pedido: *${codigo}*\n\n` +
            'Para confirmar seu pedido, envie: /confirmar\n' +
            'Para cancelar seu pedido, envie: /cancelar\n' +
            'Para verificar o status, envie: /status\n\n' +
            'Aguarde a confirmação do estabelecimento.'
        );
    } catch (error) {
        log(`Erro ao processar pedido do site: ${error}`, 'error');
        await message.reply('❌ Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.');
    }
}

// Evento para receber mensagens
client.on('message', async (message) => {
    if (message.fromMe) return;
    
    try {
        const texto = message.body;
        log(`Mensagem recebida de ${message.from}: ${texto}`, 'message');
        
        // Verifica se é um comando
        if (texto.startsWith('/')) {
            const comando = texto.slice(1);
            await processarComando(message, comando);
            return;
        }

        // Verifica se é um pedido do site
        if (texto.includes('PEDIDO - ESPETINHOS') || texto.includes('pedido - espetinhos')) {
            await processarPedidoSite(message);
            return;
        }

        // Se não for um pedido, envia o link do cardápio
        await message.reply(
            '🍖 *Bem-vindo ao nosso atendimento!* 🍖\n\n' +
            'Para fazer um pedido, acesse nosso cardápio digital:\n' +
            `${CONFIG.CARDAPIO_URL}\n\n` +
            'Depois, copie os itens desejados e envie no formato:\n' +
            '*PEDIDO - ESPETINHOS*\n' +
            '[Seus itens aqui]\n\n' +
            'Comandos disponíveis:\n' +
            '• /cardapio - Ver cardápio\n' +
            '• /confirmar - Confirmar pedido\n' +
            '• /cancelar - Cancelar pedido\n' +
            '• /status - Verificar status\n' +
            '• /ajuda - Ver ajuda\n\n' +
            '📞 *Contato:* ' + CONFIG.CONTATO
        );

    } catch (error) {
        log(`Erro ao processar mensagem: ${error}`, 'error');
        await message.reply('❌ Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
    }
});

// Rota para listar todos os pedidos
app.get('/api/pedidos', (req, res) => {
    try {
        log('Buscando lista de pedidos', 'api');
        
        // Converte o Map para um array de objetos
        const pedidos = Array.from(pedidosEmAndamento.entries()).map(([numero, pedido]) => {
            log(`Processando pedido: ${JSON.stringify(pedido)}`, 'api');
            return {
                codigo: pedido.codigo,
                numero: numero,
                status: pedido.status,
                timestamp: pedido.timestamp,
                mensagem: pedido.mensagem
            };
        });

        log(`Encontrados ${pedidos.length} pedidos: ${JSON.stringify(pedidos)}`, 'api');
        
        // Adiciona headers para CORS
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        
        res.json({
            success: true,
            pedidos: pedidos
        });
    } catch (error) {
        log(`Erro ao listar pedidos: ${error}`, 'error');
        res.status(500).json({
            success: false,
            message: 'Erro ao listar pedidos',
            error: error.message
        });
    }
});

// Rota para buscar pedido por código
app.get('/api/pedido/:codigo', (req, res) => {
    try {
        const { codigo } = req.params;
        const pedido = Array.from(pedidosEmAndamento.values()).find(p => p.codigo === codigo);

        if (pedido) {
            res.json({
                success: true,
                pedido: {
                    codigo: pedido.codigo,
                    numero: pedido.numero,
                    status: pedido.status,
                    timestamp: pedido.timestamp,
                    mensagem: pedido.mensagem
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }
    } catch (error) {
        log(`Erro ao buscar pedido: ${error}`, 'error');
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar pedido',
            error: error.message
        });
    }
});

// Rota para o dashboard
app.get('/dashboard', (req, res) => {
    log('Acessando dashboard', 'api');
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Rota para atualizar status do pedido
app.post('/api/pedido/status', async (req, res) => {
    try {
        const { numero, status, codigo } = req.body;
        
        if (!numero || !status || !codigo) {
            return res.status(400).json({ 
                success: false, 
                message: 'Número, status e código são obrigatórios' 
            });
        }

        if (!Object.values(CONFIG.STATUS_PEDIDO).includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status inválido'
            });
        }

        const pedido = pedidosEmAndamento.get(numero);
        
        if (pedido && pedido.codigo === codigo) {
            const statusAnterior = pedido.status;
            pedido.status = status;
            pedidosEmAndamento.set(numero, pedido);
            
            log(`Status do pedido ${codigo} atualizado de ${statusAnterior} para ${status}`, 'status');
            
            // Mensagens personalizadas para cada status
            let mensagemStatus = '';
            switch (status) {
                case CONFIG.STATUS_PEDIDO.EM_PREPARO:
                    mensagemStatus = '🍳 *Seu pedido está sendo preparado!*\n\n' +
                        'Assim que estiver pronto, você será notificado.';
                    break;
                case CONFIG.STATUS_PEDIDO.PRONTO:
                    mensagemStatus = '✅ *Seu pedido está pronto!*\n\n' +
                        'O entregador sairá em instantes para fazer a entrega.';
                    break;
                case CONFIG.STATUS_PEDIDO.EM_ENTREGA:
                    mensagemStatus = '🛵 *Seu pedido está a caminho!*\n\n' +
                        'O entregador saiu para fazer a entrega.';
                    break;
                case CONFIG.STATUS_PEDIDO.ENTREGUE:
                    mensagemStatus = '🎉 *Pedido entregue com sucesso!*\n\n' +
                        'Obrigado por escolher nossos serviços!\n' +
                        'Esperamos que você tenha gostado.\n\n' +
                        'Para fazer um novo pedido, envie:\n' +
                        '*PEDIDO - ESPETINHOS*\n' +
                        '[Seus itens aqui]\n\n' +
                        '📞 *Contato:* ' + CONFIG.CONTATO;
                    // Marca o pedido como finalizado após a entrega
                    pedido.status = CONFIG.STATUS_PEDIDO.FINALIZADO;
                    pedidosEmAndamento.delete(numero);
                    break;
            }
            
            // Envia mensagem para o cliente
            if (mensagemStatus) {
                const chat = await client.getChatById(numero);
                await chat.sendMessage(mensagemStatus);
            }
            
            res.json({ 
                success: true, 
                message: 'Status atualizado com sucesso',
                novoStatus: status
            });
        } else {
            res.status(404).json({ success: false, message: 'Pedido não encontrado' });
        }
    } catch (error) {
        log(`Erro ao atualizar status: ${error}`, 'error');
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao atualizar status',
            error: error.message 
        });
    }
});

// Rota para estatísticas
app.get('/api/stats', (req, res) => {
    try {
        log('Buscando estatísticas', 'api');
        const stats = {
            total_pedidos: pedidosEmAndamento.size,
            por_status: {},
            ultima_hora: 0
        };

        const umaHoraAtras = Date.now() - (60 * 60 * 1000);

        for (const pedido of pedidosEmAndamento.values()) {
            // Contagem por status
            stats.por_status[pedido.status] = (stats.por_status[pedido.status] || 0) + 1;
            
            // Pedidos na última hora
            if (pedido.timestamp > umaHoraAtras) {
                stats.ultima_hora++;
            }
        }

        log(`Estatísticas: ${JSON.stringify(stats)}`, 'api');
        
        // Adiciona headers para CORS
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        log(`Erro ao gerar estatísticas: ${error}`, 'error');
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar estatísticas',
            error: error.message
        });
    }
});

// Inicializar o cliente
client.initialize();

// Rota de saúde da API
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        pedidos_ativos: pedidosEmAndamento.size,
        uptime: process.uptime()
    });
});

// Iniciar o servidor Express
const server = app.listen(CONFIG.PORT, () => {
    log(`Servidor rodando na porta ${CONFIG.PORT}`, 'server');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        log(`Porta ${CONFIG.PORT} em uso, tentando porta ${CONFIG.PORT + 1}`, 'server');
        server.close();
        app.listen(CONFIG.PORT + 1, () => {
            log(`Servidor rodando na porta ${CONFIG.PORT + 1}`, 'server');
        });
    } else {
        log(`Erro ao iniciar servidor: ${err}`, 'error');
    }
}); 