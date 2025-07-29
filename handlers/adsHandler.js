const axios = require('axios');
const moment = require('moment-timezone');
const config = require('../dono/config.json');

class AdsHandler {
    constructor(client) {
        this.client = client;
        this.activeAds = new Map(); // Map<groupId, Map<localAdId, adData>>
        this.intervals = new Map(); // Map<groupId+localAdId, intervalId>
        this.localAdCounter = new Map(); // Map<groupId, number>
        this.syncInProgress = false; // Flag para evitar sincronizações simultâneas
        
        // Configuração da API Laravel
        this.apiConfig = {
            baseURL: config.laravelApi.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.laravelApi.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        this.api = axios.create(this.apiConfig);
        
        // Log de requests para debug
        this.api.interceptors.request.use(request => {
            console.log(`[API] ${request.method?.toUpperCase()} ${request.url}`, request.data || '');
            return request;
        });
        
        this.api.interceptors.response.use(
            response => {
                console.log(`[API] ✅ ${response.status} ${response.config.url}`);
                return response;
            },
            error => {
                console.log(`[API] ❌ ${error.response?.status || 'ERROR'} ${error.config?.url}`, error.response?.data?.message || error.message);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Inicializa o handler e sincroniza anúncios existentes
     */
    async inicializar() {
        console.log('[ADS] Inicializando handler de anúncios...');
        
        // Sincronização inicial com delay
        setTimeout(() => {
            this.sincronizarTodosGrupos().catch(console.error);
        }, 5000); // Aguarda 5 segundos antes da primeira sincronização
        
        // Sincronização periódica a cada 5 minutos (reduzido de 2min)
        setInterval(() => {
            this.sincronizarTodosGrupos().catch(console.error);
        }, 5 * 60 * 1000);
        
        console.log('[ADS] Handler inicializado com sucesso!');
    }

    /**
     * Sincroniza anúncios de todos os grupos
     */
    async sincronizarTodosGrupos() {
        // Evita sincronizações simultâneas
        if (this.syncInProgress) {
            console.log('[ADS] ⏸️ Sincronização já em andamento, pulando...');
            return;
        }
        
        this.syncInProgress = true;
        
        try {
            console.log('[ADS] 🔄 Iniciando sincronização...');
            const response = await this.api.get('/ads');
            const adsRemoto = response.data.data || [];
            
            console.log(`[ADS] 📡 Recebidos ${adsRemoto.length} anúncios do servidor`);
            
            // Agrupa anúncios por group_id
            const adsPorGrupo = {};
            adsRemoto.forEach(ad => {
                if (!adsPorGrupo[ad.group_id]) {
                    adsPorGrupo[ad.group_id] = [];
                }
                adsPorGrupo[ad.group_id].push(ad);
            });
            
            console.log(`[ADS] 📊 Grupos com anúncios: ${Object.keys(adsPorGrupo).length}`);
            
            // Sincroniza cada grupo
            for (const [groupId, ads] of Object.entries(adsPorGrupo)) {
                console.log(`[ADS] 🔄 Sincronizando grupo ${groupId} (${ads.length} anúncios)`);
                await this.sincronizarAds(groupId, ads);
                await this.delay(500); // Pequeno delay entre grupos
            }
            
            // Remove anúncios locais que não existem mais no servidor
            await this.removerAdsExcluidos(adsRemoto);
            
            console.log('[ADS] ✅ Sincronização concluída');
            
        } catch (error) {
            console.error('[ADS] ❌ Erro na sincronização:', error.message);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sincroniza anúncios de um grupo específico
     */
    async sincronizarAds(groupId, adsRemoto = null) {
        try {
            if (!adsRemoto) {
                const response = await this.api.get('/ads');
                adsRemoto = (response.data.data || []).filter(ad => ad.group_id === groupId);
            }
            
            const adsLocal = this.activeAds.get(groupId) || new Map();
            
            // Adiciona novos anúncios do servidor
            for (const adRemoto of adsRemoto) {
                if (adRemoto.group_id !== groupId) continue;
                
                // Usa o local_ad_id do servidor se existir, senão gera um novo
                let localAdId = adRemoto.local_ad_id;
                if (!localAdId) {
                    localAdId = this.gerarProximoLocalAdId(groupId);
                    console.log(`[ADS] Gerando novo local_ad_id para anúncio: ${localAdId}`);
                } else {
                    // Converte para string para garantir consistência
                    localAdId = localAdId.toString();
                }
                
                // Verifica se já existe localmente
                if (!adsLocal.has(localAdId)) {
                    console.log(`[ADS] Novo anúncio encontrado: ${groupId}:${localAdId} - "${adRemoto.content?.substring(0, 30)}..."`);
                    await this.adicionarAnuncioLocal(groupId, localAdId, adRemoto);
                } else {
                    console.log(`[ADS] Anúncio já existe localmente: ${groupId}:${localAdId}`);
                }
            }
            
        } catch (error) {
            console.error(`[ADS] Erro na sincronização do grupo ${groupId}:`, error.message);
        }
    }

    /**
     * Remove anúncios locais que foram excluídos no servidor
     */
    async removerAdsExcluidos(adsRemoto) {
        const idsRemoto = new Set();
        adsRemoto.forEach(ad => {
            if (ad.local_ad_id && ad.group_id) {
                // Garante que o ID seja string para comparação
                idsRemoto.add(`${ad.group_id}:${ad.local_ad_id.toString()}`);
            }
        });
        
        // Verifica cada anúncio local
        for (const [groupId, adsLocal] of this.activeAds.entries()) {
            const adsParaRemover = [];
            
            for (const [localAdId, adData] of adsLocal.entries()) {
                const chave = `${groupId}:${localAdId.toString()}`;
                if (!idsRemoto.has(chave)) {
                    // Só remove se não foi criado recentemente (evita race condition)
                    const agora = Date.now();
                    const criadoEm = adData.created_at || adData.joined_at || agora - 60000; // fallback
                    const tempoDecorrido = agora - new Date(criadoEm).getTime();
                    
                    if (tempoDecorrido > 30000) { // Só remove após 30 segundos
                        console.log(`[ADS] Removendo anúncio excluído: ${chave} (criado há ${Math.round(tempoDecorrido/1000)}s)`);
                        adsParaRemover.push({ groupId, localAdId });
                    } else {
                        console.log(`[ADS] Mantendo anúncio recente: ${chave} (criado há ${Math.round(tempoDecorrido/1000)}s)`);
                    }
                }
            }
            
            // Remove os anúncios identificados
            adsParaRemover.forEach(({ groupId, localAdId }) => {
                this.removerAnuncioLocal(groupId, localAdId);
            });
        }
    }

    /**
     * Adiciona um anúncio via comando do bot
     */
    async adicionarAnuncio(groupId, mensagem, intervalo, unidade) {
        try {
            const localAdId = this.gerarProximoLocalAdId(groupId);
            
            // Cria no servidor primeiro
            const response = await this.api.post('/ads', {
                group_id: groupId,
                content: mensagem,
                interval: intervalo,
                unit: unidade,
                local_ad_id: localAdId.toString()
            });
            
            const adCriado = response.data.data;
            
            // Adiciona localmente
            await this.adicionarAnuncioLocal(groupId, localAdId, adCriado);
            
            console.log(`[ADS] Anúncio criado: ${groupId}:${localAdId} - "${mensagem}"`);
            return { localAdId, adCriado };
            
        } catch (error) {
            console.error(`[ADS] Erro ao criar anúncio:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Remove um anúncio via comando do bot
     */
    async removerAnuncio(groupId, localAdId) {
        try {
            // Remove do servidor
            await this.api.delete(`/ads/${localAdId}`, {
                data: { group_id: groupId }
            });
            
            // Remove localmente
            this.removerAnuncioLocal(groupId, localAdId);
            
            console.log(`[ADS] Anúncio removido: ${groupId}:${localAdId}`);
            return true;
            
        } catch (error) {
            console.error(`[ADS] Erro ao remover anúncio:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Lista anúncios ativos de um grupo
     */
    listarAnuncios(groupId) {
        const adsLocal = this.activeAds.get(groupId);
        if (!adsLocal || adsLocal.size === 0) {
            return [];
        }
        
        return Array.from(adsLocal.entries()).map(([localAdId, adData]) => ({
            localAdId,
            content: adData.content,
            interval: adData.interval,
            unit: adData.unit,
            lastSent: adData.last_sent_at
        }));
    }

    /**
     * Adiciona um anúncio localmente e inicia o agendamento
     */
    async adicionarAnuncioLocal(groupId, localAdId, adData) {
        // Armazena o anúncio
        if (!this.activeAds.has(groupId)) {
            this.activeAds.set(groupId, new Map());
        }
        this.activeAds.get(groupId).set(localAdId, adData);
        
        // Atualiza o contador se necessário
        const currentCounter = this.localAdCounter.get(groupId) || 0;
        const idNumerico = parseInt(localAdId.toString());
        if (!isNaN(idNumerico) && idNumerico >= currentCounter) {
            this.localAdCounter.set(groupId, idNumerico + 1);
        }
        
        // Adiciona timestamp para controle
        adData.created_at = adData.created_at || new Date().toISOString();
        
        // Inicia o agendamento
        this.iniciarAgendamento(groupId, localAdId, adData);
    }

    /**
     * Remove um anúncio localmente e para o agendamento
     */
    removerAnuncioLocal(groupId, localAdId) {
        // Para o agendamento
        this.pararAgendamento(groupId, localAdId);
        
        // Remove da memória
        const adsLocal = this.activeAds.get(groupId);
        if (adsLocal) {
            adsLocal.delete(localAdId);
            if (adsLocal.size === 0) {
                this.activeAds.delete(groupId);
            }
        }
    }

    /**
     * Inicia o agendamento de um anúncio
     */
    iniciarAgendamento(groupId, localAdId, adData) {
        const chave = `${groupId}:${localAdId}`;
        
        // Para agendamento existente se houver
        this.pararAgendamento(groupId, localAdId);
        
        // Calcula intervalo em milissegundos
        const intervalMs = this.calcularIntervaloMs(adData.interval, adData.unit);
        
        if (intervalMs > 0) {
            const intervalId = setInterval(async () => {
                await this.enviarAnuncio(groupId, localAdId, adData);
            }, intervalMs);
            
            this.intervals.set(chave, intervalId);
            console.log(`[ADS] Agendamento iniciado: ${chave} (${intervalMs}ms)`);
        }
    }

    /**
     * Para o agendamento de um anúncio
     */
    pararAgendamento(groupId, localAdId) {
        const chave = `${groupId}:${localAdId}`;
        const intervalId = this.intervals.get(chave);
        
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(chave);
            console.log(`[ADS] Agendamento parado: ${chave}`);
        }
    }

    /**
     * Envia um anúncio para o grupo
     */
    async enviarAnuncio(groupId, localAdId, adData) {
        try {
            await this.client.sendMessage(groupId, adData.content);
            
            // Marca como enviado no servidor
            await this.marcarEnviado(adData.id);
            
            console.log(`[ADS] Anúncio enviado: ${groupId}:${localAdId}`);
            
        } catch (error) {
            console.error(`[ADS] Erro ao enviar anúncio ${groupId}:${localAdId}:`, error.message);
        }
    }

    /**
     * Marca um anúncio como enviado no servidor
     */
    async marcarEnviado(adId) {
        try {
            await this.api.patch(`/ads/${adId}/mark-sent`);
        } catch (error) {
            console.error(`[ADS] Erro ao marcar como enviado:`, error.message);
        }
    }

    /**
     * Gera o próximo ID local para um grupo
     */
    gerarProximoLocalAdId(groupId) {
        // Verifica o maior ID já existente para este grupo
        const adsLocal = this.activeAds.get(groupId);
        let maxId = 0;
        
        if (adsLocal) {
            for (const localAdId of adsLocal.keys()) {
                const id = parseInt(localAdId.toString());
                if (!isNaN(id) && id > maxId) {
                    maxId = id;
                }
            }
        }
        
        // Usa o counter ou o máximo + 1, o que for maior
        const counter = this.localAdCounter.get(groupId) || 1;
        const nextId = Math.max(counter, maxId + 1);
        
        this.localAdCounter.set(groupId, nextId + 1);
        return nextId.toString();
    }

    /**
     * Calcula intervalo em milissegundos
     */
    calcularIntervaloMs(interval, unit) {
        const normalizedUnit = this.normalizarUnidade(unit);
        
        switch (normalizedUnit) {
            case 'minutos':
                return interval * 60 * 1000;
            case 'horas':
                return interval * 60 * 60 * 1000;
            case 'dias':
                return interval * 24 * 60 * 60 * 1000;
            default:
                return 0;
        }
    }

    /**
     * Normaliza unidades de tempo
     */
    normalizarUnidade(unit) {
        const unitLower = unit.toLowerCase().trim();
        
        if (['m', 'min', 'minuto', 'minutos', 'minute', 'minutes'].includes(unitLower)) {
            return 'minutos';
        }
        if (['h', 'hr', 'hora', 'horas', 'hour', 'hours'].includes(unitLower)) {
            return 'horas';
        }
        if (['d', 'dia', 'dias', 'day', 'days'].includes(unitLower)) {
            return 'dias';
        }
        
        return 'minutos'; // padrão
    }
}

module.exports = AdsHandler;