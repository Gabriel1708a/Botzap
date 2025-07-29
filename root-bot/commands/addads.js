const moment = require('moment-timezone');
const config = require('../dono/config.json');

module.exports = {
    name: 'addads',
    description: 'Adiciona um anúncio automático ao grupo',
    usage: '!addads mensagem|tempo',
    example: '!addads Atenção pessoal!|30m',
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
            
            // Verifica se tem argumentos
            if (!args || args.length === 0) {
                return message.reply(`❌ Uso correto: ${this.usage}\n\n📝 Exemplo: ${this.example}`);
            }
            
            // Une os argumentos e separa por pipe
            const fullArgs = args.join(' ');
            const parts = fullArgs.split('|');
            
            if (parts.length !== 2) {
                return message.reply(`❌ Formato incorreto!\n\n📝 Use: ${this.usage}\n\n💡 Exemplo: ${this.example}`);
            }
            
            const mensagem = parts[0].trim();
            const tempoStr = parts[1].trim();
            
            if (!mensagem) {
                return message.reply('❌ A mensagem não pode estar vazia!');
            }
            
            if (!tempoStr) {
                return message.reply('❌ O tempo não pode estar vazio!');
            }
            
            // Parse do tempo
            const tempoResult = this.parseTempo(tempoStr);
            if (!tempoResult.success) {
                return message.reply(`❌ ${tempoResult.error}\n\n💡 Exemplos válidos: 30m, 1h, 2h30m, 1d`);
            }
            
            const { intervalo, unidade } = tempoResult;
            
            // Verifica limites
            if (!this.validarLimites(intervalo, unidade)) {
                return message.reply('❌ Tempo inválido! Mínimo: 1 minuto, Máximo: 7 dias');
            }
            
            message.reply('⏳ Criando anúncio...');
            
            // Adiciona o anúncio
            const result = await adsHandler.adicionarAnuncio(
                chat.id._serialized,
                mensagem,
                intervalo,
                unidade
            );
            
            const { localAdId } = result;
            
            // Monta resposta de sucesso
            const intervaloTexto = this.formatarIntervalo(intervalo, unidade);
            const response = [
                '✅ **Anúncio criado com sucesso!**',
                '',
                `🆔 **ID:** ${localAdId}`,
                `📝 **Mensagem:** ${mensagem}`,
                `⏰ **Intervalo:** ${intervaloTexto}`,
                `📍 **Grupo:** ${chat.name}`,
                '',
                '📋 Use `!listads` para ver todos os anúncios',
                '🗑️ Use `!rmads ${localAdId}` para remover'
            ].join('\n');
            
            message.reply(response);
            
        } catch (error) {
            console.error('[ADDADS] Erro:', error);
            
            let errorMsg = '❌ Erro ao criar anúncio!';
            
            if (error.response?.status === 401) {
                errorMsg += '\n🔑 Token de API inválido ou expirado.';
            } else if (error.response?.status === 422) {
                errorMsg += '\n📝 Dados inválidos enviados para a API.';
            } else if (error.code === 'ECONNREFUSED') {
                errorMsg += '\n🌐 Não foi possível conectar com o painel.';
            } else {
                errorMsg += `\n🔍 Detalhes: ${error.message}`;
            }
            
            message.reply(errorMsg);
        }
    },
    
    /**
     * Faz o parse do tempo fornecido pelo usuário
     */
    parseTempo(tempoStr) {
        // Remove espaços e converte para minúsculo
        const tempo = tempoStr.toLowerCase().replace(/\s+/g, '');
        
        // Regex para capturar números seguidos de unidades
        const regex = /(\d+)([mhd])/g;
        let match;
        let totalMinutos = 0;
        let hasMatch = false;
        
        while ((match = regex.exec(tempo)) !== null) {
            hasMatch = true;
            const valor = parseInt(match[1]);
            const unidade = match[2];
            
            switch (unidade) {
                case 'm':
                    totalMinutos += valor;
                    break;
                case 'h':
                    totalMinutos += valor * 60;
                    break;
                case 'd':
                    totalMinutos += valor * 24 * 60;
                    break;
            }
        }
        
        if (!hasMatch) {
            return {
                success: false,
                error: 'Formato de tempo inválido!'
            };
        }
        
        // Determina a melhor unidade para representar o tempo
        if (totalMinutos >= 1440 && totalMinutos % 1440 === 0) {
            // Múltiplo de dias
            return {
                success: true,
                intervalo: totalMinutos / 1440,
                unidade: 'dias'
            };
        } else if (totalMinutos >= 60 && totalMinutos % 60 === 0) {
            // Múltiplo de horas
            return {
                success: true,
                intervalo: totalMinutos / 60,
                unidade: 'horas'
            };
        } else {
            // Em minutos
            return {
                success: true,
                intervalo: totalMinutos,
                unidade: 'minutos'
            };
        }
    },
    
    /**
     * Valida se o tempo está dentro dos limites permitidos
     */
    validarLimites(intervalo, unidade) {
        let totalMinutos;
        
        switch (unidade) {
            case 'minutos':
                totalMinutos = intervalo;
                break;
            case 'horas':
                totalMinutos = intervalo * 60;
                break;
            case 'dias':
                totalMinutos = intervalo * 24 * 60;
                break;
            default:
                return false;
        }
        
        // Mínimo: 1 minuto, Máximo: 7 dias (10080 minutos)
        return totalMinutos >= 1 && totalMinutos <= 10080;
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