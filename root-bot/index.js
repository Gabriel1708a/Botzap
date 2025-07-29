const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');

// Importa configurações e handlers
const config = require('./dono/config.json');
const AdsHandler = require('./handlers/adsHandler');

class BotAdmin {
    constructor() {
        // Configuração do cliente WhatsApp
        this.client = new Client({
            authStrategy: new LocalAuth({
                name: 'bot-admin-session',
                dataPath: './sessions'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-extensions'
                ]
            }
        });
        
        // Maps para comandos e handlers
        this.commands = new Map();
        this.adsHandler = null;
        
        // Configurações do bot
        this.prefix = config.prefix;
        this.numeroDono = config.numeroDono.replace(/\D/g, '');
        this.numeroBot = config.numeroBot.replace(/\D/g, '');
        
        // Status do bot
        this.isReady = false;
        this.startTime = new Date();
        
        console.log('🤖 Bot Admin WhatsApp v' + config.botInfo.versao);
        console.log('📱 Iniciando sistema...');
    }
    
    /**
     * Inicializa o bot
     */
    async inicializar() {
        try {
            // Carrega comandos
            await this.carregarComandos();
            
            // Configura eventos do cliente
            this.configurarEventos();
            
            // Inicializa o cliente
            await this.client.initialize();
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            process.exit(1);
        }
    }
    
    /**
     * Carrega dinamicamente todos os comandos da pasta commands/
     */
    async carregarComandos() {
        try {
            const commandsPath = path.join(__dirname, 'commands');
            
            if (!await fs.pathExists(commandsPath)) {
                console.warn('⚠️ Pasta de comandos não encontrada!');
                return;
            }
            
            const commandFiles = await fs.readdir(commandsPath);
            const jsFiles = commandFiles.filter(file => file.endsWith('.js'));
            
            console.log(`📁 Carregando ${jsFiles.length} comando(s)...`);
            
            for (const file of jsFiles) {
                try {
                    const filePath = path.join(commandsPath, file);
                    
                    // Remove do cache se já existir (para hot reload)
                    delete require.cache[require.resolve(filePath)];
                    
                    const command = require(filePath);
                    
                    if (command.name) {
                        this.commands.set(command.name, command);
                        console.log(`  ✅ ${command.name} - ${command.description}`);
                    } else {
                        console.warn(`  ❌ ${file} - Comando inválido (sem nome)`);
                    }
                    
                } catch (error) {
                    console.error(`  ❌ ${file} - Erro:`, error.message);
                }
            }
            
            console.log(`📋 ${this.commands.size} comando(s) carregado(s) com sucesso!`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar comandos:', error);
        }
    }
    
    /**
     * Configura todos os eventos do cliente WhatsApp
     */
    configurarEventos() {
        // QR Code para login
        this.client.on('qr', (qr) => {
            console.log('📱 QR Code gerado! Escaneie com seu WhatsApp:');
            qrcode.generate(qr, { small: true });
        });
        
        // Cliente autenticado
        this.client.on('authenticated', () => {
            console.log('✅ Cliente autenticado com sucesso!');
        });
        
        // Falha na autenticação
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação:', msg);
        });
        
        // Cliente pronto
        this.client.on('ready', async () => {
            this.isReady = true;
            const botInfo = this.client.info;
            
            console.log('🚀 Bot está online e pronto!');
            console.log(`📱 Conectado como: ${botInfo.pushname} (${botInfo.wid.user})`);
            console.log(`⏰ Horário: ${moment().tz(config.timezone).format('DD/MM/YYYY HH:mm:ss')}`);
            
            // Inicializa o handler de anúncios
            await this.inicializarAdsHandler();
            
            // Envia mensagem de status para o dono
            await this.enviarStatusInicial();
        });
        
        // Mensagens recebidas
        this.client.on('message', async (message) => {
            await this.processarMensagem(message);
        });
        
        // Desconexão
        this.client.on('disconnected', (reason) => {
            console.log('❌ Cliente desconectado:', reason);
            
            if (config.autoReconnect) {
                console.log('🔄 Tentando reconectar...');
                setTimeout(() => {
                    this.client.initialize();
                }, 5000);
            }
        });
        
        // Erro geral
        this.client.on('error', (error) => {
            console.error('❌ Erro no cliente:', error);
        });
    }
    
    /**
     * Inicializa o handler de anúncios
     */
    async inicializarAdsHandler() {
        try {
            if (!config.laravelApi.enabled) {
                console.log('⚠️ API Laravel desabilitada - Anúncios funcionarão apenas localmente');
                return;
            }
            
            this.adsHandler = new AdsHandler(this.client);
            await this.adsHandler.inicializar();
            
            console.log('✅ Handler de anúncios inicializado!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar handler de anúncios:', error);
            // Cria um handler vazio para evitar erros
            this.adsHandler = {
                adicionarAnuncio: () => Promise.reject(new Error('Handler não disponível')),
                removerAnuncio: () => Promise.reject(new Error('Handler não disponível')),
                listarAnuncios: () => [],
                sincronizarAds: () => Promise.resolve()
            };
        }
    }
    
    /**
     * Envia status inicial para o dono
     */
    async enviarStatusInicial() {
        try {
            const donoChatId = this.numeroDono + '@c.us';
            
            const statusMsg = [
                '🤖 **BOT ADMIN ONLINE**',
                '',
                `📱 **Bot:** ${config.botInfo.nome}`,
                `📋 **Versão:** ${config.botInfo.versao}`,
                `⏰ **Iniciado em:** ${moment().tz(config.timezone).format('DD/MM/YYYY HH:mm:ss')}`,
                `📊 **Comandos:** ${this.commands.size}`,
                `🔗 **API:** ${config.laravelApi.enabled ? '✅ Conectada' : '❌ Desabilitada'}`,
                '',
                `💬 Use ${config.prefix}menu para ver todos os comandos`
            ].join('\n');
            
            await this.client.sendMessage(donoChatId, statusMsg);
            
        } catch (error) {
            console.error('❌ Erro ao enviar status inicial:', error.message);
        }
    }
    
    /**
     * Processa mensagens recebidas
     */
    async processarMensagem(message) {
        try {
            // Ignora mensagens próprias
            if (message.fromMe) return;
            
            // Ignora se não for comando
            if (!message.body.startsWith(this.prefix)) return;
            
            // Verifica se é o dono
            const contact = await message.getContact();
            const isOwner = contact.number === this.numeroDono;
            
            if (!isOwner) {
                // Pode implementar outros níveis de permissão aqui se necessário
                return;
            }
            
            // Parse do comando
            const args = message.body.slice(this.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            // Busca o comando
            const command = this.commands.get(commandName);
            
            if (!command) {
                return; // Comando não encontrado - ignora silenciosamente
            }
            
            // Log da execução
            const chat = await message.getChat();
            const chatName = chat.isGroup ? chat.name : 'Chat Privado';
            console.log(`[CMD] ${contact.pushname || contact.number}: ${this.prefix}${commandName} em ${chatName}`);
            
            // Executa o comando
            await command.execute(
                this.client,
                message,
                args,
                this.adsHandler,
                this.commands
            );
            
        } catch (error) {
            console.error('[MSG] Erro ao processar mensagem:', error);
            
            try {
                await message.reply('❌ Ocorreu um erro interno!\n\n🔍 Verifique os logs para mais detalhes.');
            } catch (replyError) {
                console.error('[MSG] Erro ao enviar resposta de erro:', replyError);
            }
        }
    }
    
    /**
     * Gerenciamento graceful de shutdown
     */
    configurarShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Sinal ${signal} recebido - Desligando bot...`);
            
            try {
                // Para todos os agendamentos
                if (this.adsHandler && this.adsHandler.intervals) {
                    for (const intervalId of this.adsHandler.intervals.values()) {
                        clearInterval(intervalId);
                    }
                }
                
                // Destrói o cliente
                if (this.client) {
                    await this.client.destroy();
                }
                
                console.log('✅ Bot desligado com segurança!');
                process.exit(0);
                
            } catch (error) {
                console.error('❌ Erro no shutdown:', error);
                process.exit(1);
            }
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGQUIT', () => shutdown('SIGQUIT'));
        
        // Erro não capturado
        process.on('uncaughtException', (error) => {
            console.error('❌ Erro não capturado:', error);
            shutdown('UNCAUGHT_EXCEPTION');
        });
        
        // Promise rejeitada não capturada
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Promise rejeitada não capturada:', reason);
            console.error('Promise:', promise);
        });
    }
}

// Função principal
async function main() {
    try {
        const bot = new BotAdmin();
        
        // Configura shutdown graceful
        bot.configurarShutdown();
        
        // Inicializa o bot
        await bot.inicializar();
        
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

// Inicia o bot se executado diretamente
if (require.main === module) {
    main();
}

module.exports = BotAdmin;