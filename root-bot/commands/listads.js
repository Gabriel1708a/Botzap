const moment = require('moment-timezone');
const config = require('../dono/config.json');

module.exports = {
    name: 'listads',
    description: 'Lista todos os anúncios ativos do grupo',
    usage: '!listads',
    example: '!listads',
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
            
            message.reply('🔍 Buscando anúncios...');
            
            // Sincroniza primeiro para garantir dados atualizados
            await adsHandler.sincronizarAds(chat.id._serialized);
            
            // Lista os anúncios
            const anuncios = adsHandler.listarAnuncios(chat.id._serialized);
            
            if (!anuncios || anuncios.length === 0) {
                const response = [
                    '📋 **Lista de Anúncios**',
                    '',
                    '🔍 Nenhum anúncio ativo encontrado neste grupo.',
                    '',
                    '💡 Use `!addads mensagem|tempo` para criar um anúncio.',
                    '',
                    '📝 Exemplo: `!addads Atenção pessoal!|30m`'
                ].join('\n');
                
                return message.reply(response);
            }
            
            // Monta a lista de anúncios
            const listaAnuncios = anuncios.map(ad => {
                const intervaloTexto = this.formatarIntervalo(ad.interval, ad.unit);
                const ultimoEnvio = ad.lastSent 
                    ? moment(ad.lastSent).tz(config.timezone).format('DD/MM/YY HH:mm')
                    : 'Nunca';
                
                const preview = ad.content.length > 50 
                    ? ad.content.substring(0, 50) + '...'
                    : ad.content;
                
                return [
                    `🆔 **${ad.localAdId}** - ${preview}`,
                    `   ⏰ ${intervaloTexto}`,
                    `   📅 Último envio: ${ultimoEnvio}`
                ].join('\n');
            });
            
            // Monta resposta completa
            const response = [
                '📋 **Lista de Anúncios Ativos**',
                '',
                `📍 **Grupo:** ${chat.name}`,
                `📊 **Total:** ${anuncios.length} anúncio${anuncios.length !== 1 ? 's' : ''}`,
                '',
                ...listaAnuncios,
                '',
                '🔧 **Comandos:**',
                '• `!addads mensagem|tempo` - Criar anúncio',
                '• `!rmads ID` - Remover anúncio',
                '• `!listads` - Listar anúncios'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[LISTADS] Erro:', error);
            
            let errorMsg = '❌ Erro ao buscar anúncios!';
            
            if (error.response?.status === 401) {
                errorMsg += '\n🔑 Token de API inválido ou expirado.';
            } else if (error.code === 'ECONNREFUSED') {
                errorMsg += '\n🌐 Não foi possível conectar com o painel.';
                errorMsg += '\n📝 Mostrando apenas anúncios locais...';
                
                // Fallback para anúncios locais
                try {
                    const anunciosLocal = adsHandler.listarAnuncios(chat.id._serialized);
                    if (anunciosLocal.length > 0) {
                        const lista = anunciosLocal.map(ad => 
                            `🆔 ${ad.localAdId} - ${ad.content.substring(0, 30)}...`
                        ).join('\n');
                        errorMsg += '\n\n📋 Anúncios locais:\n' + lista;
                    }
                } catch (localError) {
                    console.error('[LISTADS] Erro local:', localError);
                }
            } else {
                errorMsg += `\n🔍 Detalhes: ${error.message}`;
            }
            
            message.reply(errorMsg);
        }
    },
    
    /**
     * Formata o intervalo para exibição
     */
    formatarIntervalo(intervalo, unidade) {
        const unidadeTexto = {
            'minutos': intervalo === 1 ? 'minuto' : 'minutos',
            'horas': intervalo === 1 ? 'hora' : 'horas',
            'dias': intervalo === 1 ? 'dia' : 'dias'
        };
        
        return `a cada ${intervalo} ${unidadeTexto[unidade]}`;
    }
};