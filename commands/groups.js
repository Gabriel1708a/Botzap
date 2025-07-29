const moment = require('moment-timezone');
const config = require('../dono/config.json');

module.exports = {
    name: 'groups',
    description: 'Gerencia grupos vinculados ao painel',
    usage: '!groups [acao] [parametros]',
    example: '!groups list',
    category: 'admin',
    
    async execute(client, message, args, adsHandler, commands, panelHandler) {
        try {
            // Verifica se é o dono
            const contact = await message.getContact();
            if (contact.number !== config.numeroDono.replace(/\D/g, '')) {
                return message.reply('❌ Apenas o dono pode usar este comando!');
            }
            
            const action = args[0]?.toLowerCase();
            
            if (!action) {
                return this.showHelp(message);
            }
            
            switch (action) {
                case 'list':
                case 'listar':
                    await this.listGroups(client, message);
                    break;
                    
                case 'join':
                case 'entrar':
                    await this.joinGroup(client, message, args.slice(1), panelHandler);
                    break;
                    
                case 'leave':
                case 'sair':
                    await this.leaveGroup(client, message, args.slice(1), panelHandler);
                    break;
                    
                case 'info':
                case 'detalhes':
                    await this.showGroupInfo(client, message, args.slice(1));
                    break;
                    
                case 'sync':
                case 'sincronizar':
                    await this.syncGroups(client, message, panelHandler);
                    break;
                    
                default:
                    return this.showHelp(message);
            }
            
        } catch (error) {
            console.error('[GROUPS] Erro:', error);
            message.reply('❌ Erro ao executar comando de grupos!\n\n🔍 Verifique os logs para mais detalhes.');
        }
    },
    
    /**
     * Mostra ajuda do comando
     */
    async showHelp(message) {
        const help = [
            '📋 **COMANDO GROUPS - GERENCIAMENTO DE GRUPOS**',
            '',
            '🔧 **Ações disponíveis:**',
            '',
            '📋 `!groups list` - Lista todos os grupos do bot',
            '➕ `!groups join [link]` - Entra em um grupo',
            '➖ `!groups leave [id/nome]` - Sai de um grupo',
            '📊 `!groups info [id/nome]` - Mostra informações do grupo',
            '🔄 `!groups sync` - Sincroniza grupos com o painel',
            '',
            '💡 **Exemplos:**',
            '• `!groups list`',
            '• `!groups join https://chat.whatsapp.com/abc123`',
            '• `!groups leave Grupo Teste`',
            '• `!groups info 120363043611185917@g.us`',
            '',
            '⚠️ **Nota:** Apenas o dono pode gerenciar grupos'
        ].join('\n');
        
        message.reply(help);
    },
    
    /**
     * Lista todos os grupos que o bot está
     */
    async listGroups(client, message) {
        try {
            message.reply('🔍 Buscando grupos...');
            
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            if (groups.length === 0) {
                return message.reply('📋 **Lista de Grupos**\n\n🔍 Bot não está em nenhum grupo.');
            }
            
            const groupList = [];
            
            for (let i = 0; i < groups.length && i < 20; i++) {
                const group = groups[i];
                const membersCount = group.participants?.length || 0;
                const isAdmin = this.isBotAdmin(group, client);
                const adminStatus = isAdmin ? '👑 Admin' : '👤 Membro';
                
                groupList.push([
                    `📱 **${group.name || 'Grupo sem nome'}**`,
                    `   🆔 ${group.id._serialized}`,
                    `   👥 ${membersCount} membros`,
                    `   ${adminStatus}`,
                    ''
                ].join('\n'));
            }
            
            const response = [
                '📋 **LISTA DE GRUPOS**',
                '',
                `📊 **Total:** ${groups.length} grupo${groups.length !== 1 ? 's' : ''}`,
                `📱 **Mostrando:** ${Math.min(groups.length, 20)} primeiro${groups.length > 1 ? 's' : ''}`,
                '',
                ...groupList,
                '🔧 **Comandos:**',
                '• `!groups info [nome]` - Ver detalhes',
                '• `!groups leave [nome]` - Sair do grupo'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[GROUPS] Erro ao listar grupos:', error);
            message.reply('❌ Erro ao buscar grupos!\n\n💡 Tente novamente em alguns segundos.');
        }
    },
    
    /**
     * Entra em um grupo via link de convite
     */
    async joinGroup(client, message, args, panelHandler) {
        try {
            const groupLink = args[0];
            
            if (!groupLink) {
                return message.reply('❌ Você deve fornecer o link do grupo!\n\n💡 Exemplo: `!groups join https://chat.whatsapp.com/abc123`');
            }
            
            // Valida se é um link válido
            if (!groupLink.includes('chat.whatsapp.com/')) {
                return message.reply('❌ Link inválido!\n\n💡 Use um link do formato: https://chat.whatsapp.com/abc123');
            }
            
            message.reply('⏳ Processando entrada no grupo...');
            
            // Usa o PanelHandler se disponível
            if (panelHandler) {
                try {
                    const inviteCode = panelHandler.extractInviteCode(groupLink);
                    const result = await panelHandler.processGroupJoin(inviteCode);
                    
                    const response = [
                        '✅ **Bot entrou no grupo com sucesso!**',
                        '',
                        `📱 **Nome:** ${result.groupChat.name}`,
                        `🆔 **ID:** ${result.groupChat.id._serialized}`,
                        `👥 **Membros:** ${result.groupChat.participants?.length || 0}`,
                        `👑 **É Admin:** ${result.isAdmin ? 'Sim' : 'Não'}`,
                        `🔄 **Status:** ${result.wasAlreadyMember ? 'Já era membro' : 'Novo membro'}`,
                        '',
                        '💡 Use `!groups list` para ver todos os grupos'
                    ].join('\n');
                    
                    message.reply(response);
                    
                } catch (error) {
                    throw error;
                }
            } else {
                // Fallback sem PanelHandler
                const inviteCode = groupLink.split('chat.whatsapp.com/')[1];
                if (!inviteCode) {
                    throw new Error('Código de convite inválido');
                }
                
                const groupId = await client.acceptInvite(inviteCode);
                await new Promise(resolve => setTimeout(resolve, 2000));
                const groupChat = await client.getChatById(groupId);
                
                const response = [
                    '✅ **Bot entrou no grupo!**',
                    '',
                    `📱 **Nome:** ${groupChat.name}`,
                    `🆔 **ID:** ${groupId}`,
                    `👥 **Membros:** ${groupChat.participants?.length || 0}`,
                    '',
                    '⚠️ **Nota:** Grupo não foi sincronizado com o painel'
                ].join('\n');
                
                message.reply(response);
            }
            
        } catch (error) {
            console.error('[GROUPS] Erro ao entrar no grupo:', error);
            
            let errorMsg = '❌ Erro ao entrar no grupo!';
            
            if (error.message.includes('already') || error.message.includes('member')) {
                errorMsg += '\n🔍 Bot já é membro deste grupo.';
            } else if (error.message.includes('invalid') || error.message.includes('inválido')) {
                errorMsg += '\n🔗 Link de convite inválido ou expirado.';
            } else if (error.message.includes('banned')) {
                errorMsg += '\n🚫 Bot foi banido deste grupo.';
            } else {
                errorMsg += `\n🔍 Detalhes: ${error.message}`;
            }
            
            message.reply(errorMsg);
        }
    },
    
    /**
     * Sai de um grupo
     */
    async leaveGroup(client, message, args) {
        try {
            const groupIdentifier = args.join(' ');
            
            if (!groupIdentifier) {
                return message.reply('❌ Você deve especificar o grupo!\n\n💡 Exemplo: `!groups leave Grupo Teste` ou `!groups leave 120363043611185917@g.us`');
            }
            
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            // Busca o grupo por nome ou ID
            let targetGroup = groups.find(group => 
                group.id._serialized === groupIdentifier ||
                group.name?.toLowerCase().includes(groupIdentifier.toLowerCase())
            );
            
            if (!targetGroup) {
                return message.reply(`❌ Grupo "${groupIdentifier}" não encontrado!\n\n💡 Use \`!groups list\` para ver os grupos disponíveis.`);
            }
            
            // Confirma a saída
            const confirmMsg = [
                '⚠️ **CONFIRMAÇÃO DE SAÍDA**',
                '',
                `📱 **Grupo:** ${targetGroup.name}`,
                `👥 **Membros:** ${targetGroup.participants?.length || 0}`,
                '',
                '❓ Tem certeza que deseja sair deste grupo?',
                '',
                '💡 Responda com "sim" para confirmar ou ignore para cancelar.'
            ].join('\n');
            
            await message.reply(confirmMsg);
            
            // Aguarda confirmação (implementação básica)
            // Em uma implementação mais robusta, você poderia usar um sistema de callback
            
        } catch (error) {
            console.error('[GROUPS] Erro ao sair do grupo:', error);
            message.reply('❌ Erro ao processar saída do grupo!\n\n🔍 Verifique os logs para mais detalhes.');
        }
    },
    
    /**
     * Mostra informações detalhadas de um grupo
     */
    async showGroupInfo(client, message, args) {
        try {
            const groupIdentifier = args.join(' ');
            
            if (!groupIdentifier) {
                return message.reply('❌ Você deve especificar o grupo!\n\n💡 Exemplo: `!groups info Grupo Teste`');
            }
            
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            let targetGroup = groups.find(group => 
                group.id._serialized === groupIdentifier ||
                group.name?.toLowerCase().includes(groupIdentifier.toLowerCase())
            );
            
            if (!targetGroup) {
                return message.reply(`❌ Grupo "${groupIdentifier}" não encontrado!`);
            }
            
            message.reply('🔍 Coletando informações do grupo...');
            
            // Coleta informações detalhadas
            const isAdmin = this.isBotAdmin(targetGroup, client);
            const createdAt = targetGroup.createdAt ? 
                moment(targetGroup.createdAt * 1000).tz(config.timezone).format('DD/MM/YYYY HH:mm') : 
                'Não disponível';
            
            let groupPic = null;
            try {
                groupPic = await client.getProfilePicUrl(targetGroup.id._serialized);
            } catch (picError) {
                // Foto não disponível
            }
            
            const response = [
                '📊 **INFORMAÇÕES DO GRUPO**',
                '',
                `📱 **Nome:** ${targetGroup.name || 'Sem nome'}`,
                `📝 **Descrição:** ${targetGroup.description || 'Sem descrição'}`,
                `🆔 **ID:** ${targetGroup.id._serialized}`,
                `👥 **Membros:** ${targetGroup.participants?.length || 0}`,
                `👑 **Bot é Admin:** ${isAdmin ? 'Sim' : 'Não'}`,
                `📅 **Criado em:** ${createdAt}`,
                `🖼️ **Foto:** ${groupPic ? 'Disponível' : 'Não disponível'}`,
                `🔇 **Silenciado:** ${targetGroup.isMuted ? 'Sim' : 'Não'}`,
                `📌 **Fixado:** ${targetGroup.isPinned ? 'Sim' : 'Não'}`,
                '',
                '🔧 **Ações disponíveis:**',
                '• `!groups leave ' + targetGroup.name + '` - Sair do grupo',
                '• `!addads mensagem|tempo` - Criar anúncio (no grupo)',
                '• `!listads` - Ver anúncios (no grupo)'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[GROUPS] Erro ao mostrar info do grupo:', error);
            message.reply('❌ Erro ao buscar informações do grupo!');
        }
    },
    
    /**
     * Sincroniza grupos com o painel
     */
    async syncGroups(client, message, panelHandler) {
        try {
            message.reply('🔄 Iniciando sincronização com o painel...');
            
            if (!panelHandler) {
                return message.reply('❌ PanelHandler não disponível!\n\n⚠️ Sincronização manual necessária.');
            }
            
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            let syncedCount = 0;
            let errorCount = 0;
            
            for (const group of groups) {
                try {
                    const groupData = await panelHandler.prepareGroupData(group, 1, false); // user_id padrão
                    await panelHandler.sendConfirmationToPanel(groupData);
                    syncedCount++;
                } catch (syncError) {
                    console.error(`[GROUPS] Erro ao sincronizar ${group.name}:`, syncError.message);
                    errorCount++;
                }
                
                // Delay entre sincronizações
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const response = [
                '✅ **SINCRONIZAÇÃO CONCLUÍDA**',
                '',
                `📊 **Total de grupos:** ${groups.length}`,
                `✅ **Sincronizados:** ${syncedCount}`,
                `❌ **Erros:** ${errorCount}`,
                '',
                syncedCount > 0 ? '🎉 Grupos sincronizados com sucesso!' : '⚠️ Nenhum grupo foi sincronizado.'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[GROUPS] Erro na sincronização:', error);
            message.reply('❌ Erro durante a sincronização!\n\n🔍 Verifique os logs para mais detalhes.');
        }
    },
    
    /**
     * Verifica se o bot é admin em um grupo
     */
    isBotAdmin(group, client) {
        try {
            const participants = group.participants || [];
            const botNumber = client.info?.wid?.user || config.numeroBot.replace(/\D/g, '');
            const botParticipant = participants.find(p => p.id.user === botNumber);
            return botParticipant?.isAdmin || false;
        } catch (error) {
            return false;
        }
    }
};