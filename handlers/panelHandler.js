const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const config = require('../dono/config.json');

class PanelHandler {
    constructor(client) {
        this.client = client;
        this.app = null;
        this.server = null;
        this.isInitialized = false;
        
        // Configuração da API Laravel
        this.apiConfig = {
            baseURL: config.laravelApi.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.laravelApi.token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'WhatsApp-Bot/2.0'
            },
            timeout: 15000
        };
        
        this.api = axios.create(this.apiConfig);
    }
    
    /**
     * Inicializa o servidor Express para receber requisições do painel
     */
    initialize() {
        if (this.isInitialized) {
            console.log('[PANEL] Servidor já inicializado.');
            return;
        }
        
        if (!this.client) {
            console.error('[PANEL] ❌ Cliente WhatsApp não disponível!');
            return;
        }
        
        this.app = express();
        this.app.use(express.json({ limit: '10mb' }));
        
        // Middleware de log para requests
        this.app.use((req, res, next) => {
            console.log(`[PANEL] ${req.method} ${req.path}`, req.body || '');
            next();
        });
        
        // Middleware de erro global
        this.app.use((error, req, res, next) => {
            console.error('[PANEL] Erro no middleware:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        });
        
        // Rotas da API
        this.setupRoutes();
        
        const port = config.panelHandler?.port || 3000;
        const host = config.panelHandler?.host || '0.0.0.0';
        
        this.server = this.app.listen(port, host, () => {
            console.log(`[PANEL] ✅ Servidor inicializado em ${host}:${port}`);
            this.isInitialized = true;
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    
    /**
     * Configura todas as rotas da API
     */
    setupRoutes() {
        // Rota principal: Entrar em grupo
        this.app.post('/join-group', this.handleJoinGroupRequest.bind(this));
        
        // Rota para verificar grupos existentes
        this.app.post('/verify-group', this.handleVerifyGroup.bind(this));
        
        // Rota para sair de grupos
        this.app.post('/leave-group', this.handleLeaveGroup.bind(this));
        
        // Rota de status do bot
        this.app.get('/status', this.handleStatusCheck.bind(this));
        
        // Rota de health check
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                status: 'online',
                timestamp: new Date().toISOString(),
                bot_info: config.botInfo
            });
        });
    }
    
    /**
     * Processa solicitação para entrar em grupo
     */
    async handleJoinGroupRequest(req, res) {
        const startTime = Date.now();
        const { group_link, user_id, auto_ads = false } = req.body;
        
        console.log(`[PANEL] 🚀 Solicitação para entrar no grupo:`, {
            group_link,
            user_id,
            auto_ads
        });
        
        // Validação de entrada
        if (!group_link || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'group_link e user_id são obrigatórios.',
                required_fields: ['group_link', 'user_id']
            });
        }
        
        try {
            // Verifica se o cliente está pronto
            if (!await this.isClientReady()) {
                throw new Error('Cliente WhatsApp não está conectado');
            }
            
            // Extrai código do convite
            const inviteCode = this.extractInviteCode(group_link);
            console.log(`[PANEL] Código de convite: ${inviteCode}`);
            
            // Processa entrada no grupo
            const groupResult = await this.processGroupJoin(inviteCode);
            const groupId = groupResult.groupChat.id._serialized;
            
            // Prepara dados do grupo
            const groupData = await this.prepareGroupData(groupResult.groupChat, user_id, auto_ads);
            
            // Envia confirmação para o painel Laravel
            const panelResponse = await this.sendConfirmationToPanel(groupData);
            
            console.log(`[PANEL] ✅ Grupo processado em ${Date.now() - startTime}ms`);
            
            return res.status(200).json({
                success: true,
                message: 'Bot entrou no grupo com sucesso!',
                data: {
                    group_id: groupId,
                    group_name: groupData.name,
                    members_count: groupResult.groupChat.participants?.length || 0,
                    bot_is_admin: groupResult.isAdmin,
                    processing_time: Date.now() - startTime,
                    panel_response: panelResponse?.data
                }
            });
            
        } catch (error) {
            console.error('[PANEL] Erro ao processar grupo:', error);
            const errorResponse = this.getErrorResponse(error);
            
            return res.status(errorResponse.status).json({
                success: false,
                message: errorResponse.message,
                error_type: errorResponse.type,
                processing_time: Date.now() - startTime
            });
        }
    }
    
    /**
     * Verifica se o bot já está em um grupo
     */
    async handleVerifyGroup(req, res) {
        const { group_link, user_id } = req.body;
        
        try {
            if (!group_link) {
                return res.status(400).json({
                    success: false,
                    message: 'group_link é obrigatório.'
                });
            }
            
            const inviteCode = this.extractInviteCode(group_link);
            
            // Tenta obter informações do convite
            const inviteInfo = await this.client.getInviteInfo(inviteCode);
            
            if (inviteInfo && inviteInfo.id) {
                const groupId = inviteInfo.id._serialized;
                const groupChat = await this.client.getChatById(groupId);
                
                return res.json({
                    success: true,
                    is_member: true,
                    group_info: {
                        id: groupId,
                        name: groupChat.name || 'Grupo sem nome',
                        description: groupChat.description || '',
                        members_count: groupChat.participants?.length || 0
                    }
                });
            }
            
            return res.json({
                success: true,
                is_member: false,
                message: 'Bot não está no grupo ou convite inválido'
            });
            
        } catch (error) {
            console.error('[PANEL] Erro ao verificar grupo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao verificar grupo',
                error: error.message
            });
        }
    }
    
    /**
     * Remove o bot de um grupo
     */
    async handleLeaveGroup(req, res) {
        const { group_id, user_id, reason = 'Solicitado pelo usuário' } = req.body;
        
        try {
            if (!group_id) {
                return res.status(400).json({
                    success: false,
                    message: 'group_id é obrigatório.'
                });
            }
            
            // Sai do grupo
            await this.client.leaveGroup(group_id);
            
            // Notifica o painel Laravel
            await this.notifyGroupLeft(group_id, user_id, reason);
            
            return res.json({
                success: true,
                message: 'Bot saiu do grupo com sucesso'
            });
            
        } catch (error) {
            console.error('[PANEL] Erro ao sair do grupo:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao sair do grupo',
                error: error.message
            });
        }
    }
    
    /**
     * Verifica status do bot
     */
    async handleStatusCheck(req, res) {
        try {
            const state = await this.client.getState();
            const info = this.client.info;
            
            return res.json({
                success: true,
                status: state,
                connected: state === 'CONNECTED',
                bot_info: {
                    name: info?.pushname || 'Bot Admin',
                    number: info?.wid?.user || config.numeroBot,
                    version: config.botInfo.versao
                },
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao verificar status',
                error: error.message
            });
        }
    }
    
    /**
     * Extrai código de convite do link
     */
    extractInviteCode(groupLink) {
        if (!groupLink) throw new Error('Link do grupo não fornecido');
        
        let inviteCode = groupLink.trim();
        
        // Remove protocolo
        if (inviteCode.startsWith('https://')) {
            inviteCode = inviteCode.substring(8);
        }
        if (inviteCode.startsWith('http://')) {
            inviteCode = inviteCode.substring(7);
        }
        
        // Extrai código do chat.whatsapp.com
        if (inviteCode.includes('chat.whatsapp.com/')) {
            inviteCode = inviteCode.split('chat.whatsapp.com/')[1];
        }
        
        // Remove parâmetros extras
        if (inviteCode.includes('?')) {
            inviteCode = inviteCode.split('?')[0];
        }
        if (inviteCode.includes('#')) {
            inviteCode = inviteCode.split('#')[0];
        }
        
        if (!inviteCode || inviteCode.length < 10) {
            throw new Error('Código de convite inválido ou muito curto');
        }
        
        return inviteCode;
    }
    
    /**
     * Processa entrada no grupo com lógica melhorada
     */
    async processGroupJoin(inviteCode) {
        console.log(`[PANEL] Processando entrada no grupo: ${inviteCode}`);
        
        try {
            // Primeiro, tenta obter informações do convite
            let groupInfo;
            try {
                groupInfo = await this.client.getInviteInfo(inviteCode);
                console.log(`[PANEL] Informações do convite obtidas:`, groupInfo?.title);
            } catch (infoError) {
                console.warn(`[PANEL] Não foi possível obter informações do convite: ${infoError.message}`);
            }
            
            // Tenta entrar no grupo
            let groupId;
            let wasAlreadyMember = false;
            
            try {
                groupId = await this.client.acceptInvite(inviteCode);
                console.log(`[PANEL] ✅ Bot entrou no grupo! ID: ${groupId}`);
            } catch (joinError) {
                // Se já é membro, usa as informações do convite
                if (joinError.message.includes('already') || joinError.message.includes('member')) {
                    console.log(`[PANEL] Bot já era membro do grupo`);
                    wasAlreadyMember = true;
                    
                    if (groupInfo && groupInfo.id) {
                        groupId = groupInfo.id._serialized;
                    } else {
                        throw new Error('Bot já é membro, mas não foi possível obter ID do grupo');
                    }
                } else {
                    throw joinError;
                }
            }
            
            // Aguarda sincronização
            await this.delay(wasAlreadyMember ? 1000 : 3000);
            
            // Obtém detalhes completos do chat
            const groupChat = await this.client.getChatById(groupId);
            
            // Verifica se o bot é admin
            let isAdmin = false;
            try {
                const participants = groupChat.participants || [];
                const botNumber = this.client.info?.wid?.user || config.numeroBot.replace(/\D/g, '');
                const botParticipant = participants.find(p => p.id.user === botNumber);
                isAdmin = botParticipant?.isAdmin || false;
                console.log(`[PANEL] Bot é admin: ${isAdmin}`);
            } catch (adminError) {
                console.warn(`[PANEL] Erro ao verificar status de admin: ${adminError.message}`);
            }
            
            // Fallback para nome do grupo
            if (!groupChat.name) {
                groupChat.name = groupInfo?.title || `Grupo ${groupChat.id.user}`;
                console.log(`[PANEL] Nome do grupo definido via fallback: ${groupChat.name}`);
            }
            
            return {
                groupChat,
                isAdmin,
                wasAlreadyMember
            };
            
        } catch (error) {
            console.error(`[PANEL] Erro ao processar entrada no grupo:`, error);
            throw error;
        }
    }
    
    /**
     * Prepara dados do grupo para envio ao painel
     */
    async prepareGroupData(groupChat, userId, autoAds = false) {
        const groupId = groupChat.id._serialized;
        let iconUrl = null;
        
        // Tenta obter foto do grupo
        try {
            iconUrl = await this.client.getProfilePicUrl(groupId);
            console.log(`[PANEL] ✅ Foto do grupo obtida`);
        } catch (picError) {
            console.warn(`[PANEL] ⚠️ Não foi possível obter foto do grupo: ${picError.message}`);
        }
        
        return {
            user_id: userId,
            group_id: groupId,
            name: groupChat.name || `Grupo ${groupChat.id.user}`,
            description: groupChat.description || null,
            icon_url: iconUrl,
            is_active: true,
            auto_ads_enabled: autoAds,
            members_count: groupChat.participants?.length || 0,
            expires_at: moment().add(30, 'days').toISOString(),
            joined_at: new Date().toISOString()
        };
    }
    
    /**
     * Envia confirmação para o painel Laravel
     */
    async sendConfirmationToPanel(groupData) {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PANEL] Enviando confirmação (tentativa ${attempt}):`, groupData.group_id);
                
                const response = await this.api.post('/groups/confirm', groupData);
                
                console.log(`[PANEL] ✅ Confirmação enviada com sucesso`);
                return response;
                
            } catch (error) {
                console.warn(`[PANEL] Tentativa ${attempt} falhou:`, error.response?.data || error.message);
                
                if (attempt === maxRetries) {
                    throw new Error(`Falha ao confirmar no painel após ${maxRetries} tentativas: ${error.message}`);
                }
                
                await this.delay(1000 * attempt);
            }
        }
    }
    
    /**
     * Notifica o painel quando o bot sai de um grupo
     */
    async notifyGroupLeft(groupId, userId, reason) {
        try {
            await this.api.post('/groups/left', {
                group_id: groupId,
                user_id: userId,
                reason: reason,
                left_at: new Date().toISOString()
            });
            console.log(`[PANEL] ✅ Notificação de saída enviada`);
        } catch (error) {
            console.error(`[PANEL] Erro ao notificar saída:`, error.message);
        }
    }
    
    /**
     * Verifica se o cliente está pronto
     */
    async isClientReady() {
        try {
            const state = await this.client.getState();
            return state === 'CONNECTED';
        } catch (error) {
            console.error('[PANEL] Erro ao verificar estado do cliente:', error);
            return false;
        }
    }
    
    /**
     * Mapeia erros para respostas HTTP apropriadas
     */
    getErrorResponse(error) {
        const message = error.message || 'Erro desconhecido';
        
        if (message.includes('Evaluation failed') || message.includes('Protocol error')) {
            return {
                status: 500,
                message: 'Erro interno do WhatsApp Web. Tente novamente em alguns minutos.',
                type: 'WHATSAPP_INTERNAL_ERROR'
            };
        }
        
        if (message.includes('inválido') || message.includes('expirado') || message.includes('invalid')) {
            return {
                status: 400,
                message: 'Link de convite inválido ou expirado.',
                type: 'INVALID_INVITE'
            };
        }
        
        if (message.includes('conectado') || message.includes('not ready')) {
            return {
                status: 503,
                message: 'Bot não está conectado ao WhatsApp. Tente novamente em alguns minutos.',
                type: 'BOT_NOT_READY'
            };
        }
        
        if (message.includes('painel') || message.includes('confirm')) {
            return {
                status: 500,
                message: 'Bot entrou no grupo, mas houve erro na confirmação com o painel.',
                type: 'PANEL_CONFIRMATION_ERROR'
            };
        }
        
        if (message.includes('banned') || message.includes('banido')) {
            return {
                status: 403,
                message: 'Bot foi banido deste grupo.',
                type: 'BOT_BANNED'
            };
        }
        
        return {
            status: 500,
            message: `Erro inesperado: ${message}`,
            type: 'UNKNOWN_ERROR'
        };
    }
    
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Shutdown graceful
     */
    shutdown() {
        if (this.server) {
            console.log('[PANEL] Desligando servidor...');
            this.server.close(() => {
                console.log('[PANEL] ✅ Servidor desligado');
            });
        }
    }
}

module.exports = PanelHandler;