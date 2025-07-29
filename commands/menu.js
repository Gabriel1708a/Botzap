const config = require('../dono/config.json');

module.exports = {
    name: 'menu',
    description: 'Exibe o menu com todos os comandos disponíveis',
    usage: '!menu',
    example: '!menu',
    category: 'general',
    
    async execute(client, message, args, adsHandler, commands) {
        try {
            const chat = await message.getChat();
            const contact = await message.getContact();
            
            // Verifica se é o dono
            const isDono = contact.number === config.numeroDono.replace(/\D/g, '');
            
            if (!isDono) {
                return message.reply('❌ Apenas o dono pode usar este comando!');
            }
            
            // Agrupa comandos por categoria
            const categorias = {};
            
            commands.forEach((command, name) => {
                const categoria = command.category || 'outros';
                if (!categorias[categoria]) {
                    categorias[categoria] = [];
                }
                categorias[categoria].push(command);
            });
            
            // Monta o menu
            const menuSections = [];
            
            // Cabeçalho
            menuSections.push([
                '🤖 **BOT ADMINISTRADOR WHATSAPP**',
                '',
                `📱 **Bot:** ${config.botInfo.nome}`,
                `📋 **Versão:** ${config.botInfo.versao}`,
                `📍 **Local:** ${chat.isGroup ? `Grupo: ${chat.name}` : 'Chat Privado'}`,
                `⏰ **Horário:** ${new Date().toLocaleString('pt-BR', { timeZone: config.timezone })}`,
                ''
            ].join('\n'));
            
            // Seção de anúncios
            if (categorias.ads) {
                menuSections.push([
                    '📢 **COMANDOS DE ANÚNCIOS**',
                    ''
                ].join('\n'));
                
                categorias.ads.forEach(command => {
                    menuSections.push([
                        `${config.prefix}${command.name}`,
                        `   📝 ${command.description}`,
                        `   💡 Exemplo: \`${command.example}\``,
                        ''
                    ].join('\n'));
                });
            }
            
            // Seção geral
            if (categorias.general) {
                menuSections.push([
                    '⚙️ **COMANDOS GERAIS**',
                    ''
                ].join('\n'));
                
                categorias.general.forEach(command => {
                    if (command.name !== 'menu') { // Não mostra o próprio menu
                        menuSections.push([
                            `${config.prefix}${command.name}`,
                            `   📝 ${command.description}`,
                            `   💡 Exemplo: \`${command.example}\``,
                            ''
                        ].join('\n'));
                    }
                });
            }
            
            // Informações adicionais
            let anunciosCount = 0;
            if (chat.isGroup) {
                const anuncios = adsHandler.listarAnuncios(chat.id._serialized);
                anunciosCount = anuncios.length;
            }
            
            menuSections.push([
                '📊 **STATUS ATUAL**',
                '',
                `📢 Anúncios ativos: ${anunciosCount}`,
                `🔗 API Laravel: ${config.laravelApi.enabled ? '✅ Ativada' : '❌ Desativada'}`,
                `🔄 Sincronização: ${config.laravelApi.enabled ? 'A cada 2 minutos' : 'Desabilitada'}`,
                ''
            ].join('\n'));
            
            // Rodapé
            menuSections.push([
                '🔧 **INFORMAÇÕES**',
                '',
                '• Todos os comandos começam com `!`',
                '• Apenas o dono pode usar os comandos',
                '• Anúncios funcionam apenas em grupos',
                '• Sincronização automática com o painel',
                '',
                '🌟 **Desenvolvido por Gabriel**'
            ].join('\n'));
            
            // Junta todas as seções
            const menuCompleto = menuSections.join('\n');
            
            message.reply(menuCompleto);
            
        } catch (error) {
            console.error('[MENU] Erro:', error);
            message.reply('❌ Erro ao exibir menu!\n\n🔍 Verifique os logs para mais detalhes.');
        }
    }
};