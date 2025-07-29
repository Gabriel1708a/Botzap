const config = require('../dono/config.json');

module.exports = {
    name: 'rmads',
    description: 'Remove um anúncio pelo ID',
    usage: '!rmads ID',
    example: '!rmads 1',
    category: 'ads',
    
    async execute(client, message, args, adsHandler) {
        try {
            // Verifica se é grupo
            const chat = await message.getChat();
            if (!chat.isGroup) {
                return message.reply('❌ Este comando só pode ser usado em grupos!');
            }
            
            // Verifica se é o dono
            const contact = await message.getContact();
            if (contact.number !== config.numeroDono.replace(/\D/g, '')) {
                return message.reply('❌ Apenas o dono pode usar este comando!');
            }
            
            // Verifica se foi fornecido o ID
            if (!args || args.length === 0) {
                return message.reply(`❌ Uso correto: ${this.usage}\n\n📝 Exemplo: ${this.example}\n\n💡 Use \`!listads\` para ver os IDs disponíveis.`);
            }
            
            const localAdId = args[0].trim();
            
            // Valida se é um número
            if (!/^\d+$/.test(localAdId)) {
                return message.reply('❌ O ID deve ser um número!\n\n💡 Use `!listads` para ver os IDs válidos.');
            }
            
            // Verifica se o anúncio existe localmente
            const anuncios = adsHandler.listarAnuncios(chat.id._serialized);
            const anuncioExistente = anuncios.find(ad => ad.localAdId.toString() === localAdId);
            
            if (!anuncioExistente) {
                const response = [
                    '❌ **Anúncio não encontrado!**',
                    '',
                    `🔍 Não existe anúncio com ID **${localAdId}** neste grupo.`,
                    '',
                    '💡 Use `!listads` para ver os anúncios disponíveis.'
                ].join('\n');
                
                return message.reply(response);
            }
            
            message.reply('⏳ Removendo anúncio...');
            
            // Remove o anúncio
            await adsHandler.removerAnuncio(chat.id._serialized, localAdId);
            
            // Monta resposta de sucesso
            const preview = anuncioExistente.content.length > 50 
                ? anuncioExistente.content.substring(0, 50) + '...'
                : anuncioExistente.content;
            
            const response = [
                '✅ **Anúncio removido com sucesso!**',
                '',
                `🆔 **ID:** ${localAdId}`,
                `📝 **Mensagem:** ${preview}`,
                `📍 **Grupo:** ${chat.name}`,
                '',
                '📋 Use `!listads` para ver os anúncios restantes'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[RMADS] Erro:', error);
            
            let errorMsg = '❌ Erro ao remover anúncio!';
            
            if (error.response?.status === 401) {
                errorMsg += '\n🔑 Token de API inválido ou expirado.';
            } else if (error.response?.status === 404) {
                errorMsg += '\n🔍 Anúncio não encontrado no servidor.';
                errorMsg += '\n💡 Pode ter sido removido pelo painel.';
            } else if (error.code === 'ECONNREFUSED') {
                errorMsg += '\n🌐 Não foi possível conectar com o painel.';
                errorMsg += '\n⚠️ O anúncio pode não ter sido removido do servidor.';
            } else {
                errorMsg += `\n🔍 Detalhes: ${error.message}`;
            }
            
            message.reply(errorMsg);
        }
    }
};