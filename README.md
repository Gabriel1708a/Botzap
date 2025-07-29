# 🤖 Bot Administrador WhatsApp com Integração Laravel

Bot administrador de grupos WhatsApp com sistema de anúncios automáticos e integração completa com painel Laravel.

## 📋 Características

- ✅ **Anúncios Automáticos**: Crie, liste e remova anúncios programados
- ✅ **Integração Laravel**: Sincronização bidirecional com API
- ✅ **Comandos Dinâmicos**: Sistema modular de comandos
- ✅ **Sessão Persistente**: Mantém login após reinicialização
- ✅ **Monitoramento**: Logs detalhados e status em tempo real
- ✅ **Reconexão Automática**: Reconecta automaticamente em caso de queda

## 🔧 Pré-requisitos

- **Node.js** v18+ instalado
- **NPM** ou **Yarn**
- **PM2** (para produção)
- Conta WhatsApp para o bot
- Acesso ao painel Laravel (opcional)

## 📦 Instalação

### 1. Clone/Baixe o projeto
```bash
# Se usando Git
git clone <url-do-repositorio>
cd root-bot

# Ou apenas extraia os arquivos na pasta root-bot/
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o bot
Edite o arquivo `dono/config.json`:

```json
{
  "numeroBot": "5543996191225",        // Número do bot (com DDI)
  "numeroDono": "554191236158",        // SEU número (com DDI)
  "prefix": "!",                       // Prefixo dos comandos
  "timezone": "America/Sao_Paulo",     // Fuso horário
  "autoReconnect": true,               // Reconexão automática
  "sessaoPersistente": true,           // Manter sessão
  "laravelApi": {
    "enabled": true,                   // true = integração ativa
    "baseUrl": "https://painel.botwpp.tech/api",
    "token": "SEU_TOKEN_AQUI"          // Token do painel
  }
}
```

## 🚀 Execução

### Desenvolvimento
```bash
# Execução simples
npm start

# Com auto-reload (nodemon)
npm run dev
```

### Produção (PM2)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o bot
npm run pm2:start

# Ver logs
npm run pm2:logs

# Parar o bot
npm run pm2:stop

# Reiniciar o bot
npm run pm2:restart
```

### ⚡ Primeira Execução

1. Execute `npm start`
2. Escaneie o QR Code com seu WhatsApp
3. Bot será autenticado e ficará online
4. Você receberá uma mensagem de status no privado

## 📱 Comandos Disponíveis

### 📢 Anúncios

#### `!addads mensagem|tempo`
Cria um novo anúncio automático no grupo.

**Exemplos:**
```
!addads Atenção pessoal!|30m          // A cada 30 minutos
!addads Regras do grupo|1h             // A cada 1 hora  
!addads Evento especial|2h30m          // A cada 2h30min
!addads Backup diário|1d               // A cada 1 dia
```

**Formatos de tempo aceitos:**
- `m` = minutos
- `h` = horas  
- `d` = dias
- Combinações: `2h30m`, `1d12h`, etc.

#### `!listads`
Lista todos os anúncios ativos do grupo atual.

#### `!rmads ID`
Remove um anúncio pelo ID local.

**Exemplo:**
```
!rmads 1                               // Remove anúncio ID 1
```

### ⚙️ Gerais

#### `!menu`
Exibe o menu completo com todos os comandos e status.

## 🔄 Integração com Laravel

### Endpoints da API

O bot se integra com os seguintes endpoints:

- `GET /api/ads` - Lista anúncios
- `POST /api/ads` - Cria anúncio
- `DELETE /api/ads/{localAdId}` - Remove por ID local
- `DELETE /api/ads/{id}` - Remove por ID
- `PATCH /api/ads/{id}/mark-sent` - Marca como enviado

### Headers Obrigatórios
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Sincronização

- **Automática**: A cada 2 minutos
- **Manual**: Ao executar comandos
- **Bidirecional**: Bot ↔ Painel Laravel

## 📁 Estrutura de Arquivos

```
root-bot/
├── commands/           # Comandos do bot
│   ├── addads.js      # Criar anúncios
│   ├── listads.js     # Listar anúncios  
│   ├── rmads.js       # Remover anúncios
│   └── menu.js        # Menu principal
├── handlers/           # Integrações
│   └── adsHandler.js  # Handler de anúncios
├── dono/              # Configurações
│   └── config.json    # Config principal
├── sessions/          # Sessões WhatsApp (auto-criado)
├── index.js           # Arquivo principal
├── package.json       # Dependências
└── README.md          # Este arquivo
```

## 🔧 Adicionando Novos Comandos

1. Crie um arquivo `.js` na pasta `commands/`
2. Use a estrutura padrão:

```javascript
const config = require('../dono/config.json');

module.exports = {
    name: 'meucomando',
    description: 'Descrição do comando',
    usage: '!meucomando argumento',
    example: '!meucomando teste',
    category: 'geral',
    
    async execute(client, message, args, adsHandler) {
        // Lógica do comando aqui
        message.reply('Comando executado!');
    }
};
```

3. Reinicie o bot - será carregado automaticamente

## 🛠️ Solução de Problemas

### Bot não conecta
- Verifique se o WhatsApp está aberto no celular
- Delete a pasta `sessions/` e tente novamente
- Certifique-se que o Node.js está atualizado

### Erro de API Laravel
- Verifique se o `baseUrl` está correto
- Confirme se o `token` está válido
- Teste a conectividade: `curl -H "Authorization: Bearer SEU_TOKEN" URL/api/ads`

### Anúncios não funcionam
- Verifique se é um grupo (anúncios só funcionam em grupos)
- Confirme se é o dono configurado
- Veja os logs para detalhes do erro

### Logs PM2
```bash
pm2 logs bot-admin     # Ver logs em tempo real
pm2 flush bot-admin    # Limpar logs
```

## 📊 Monitoramento

### Status em Tempo Real
- Logs detalhados no console
- Mensagem de status ao iniciar
- Contadores de anúncios ativos

### Comando `!menu`
Mostra informações completas:
- Versão do bot
- Quantidade de comandos
- Status da API
- Anúncios ativos

## 🔐 Segurança

- ✅ Apenas o dono pode usar comandos
- ✅ Validação de entrada em todos os comandos  
- ✅ Rate limiting automático do WhatsApp
- ✅ Logs de todas as ações

## 🆘 Suporte

### Contatos
- **Desenvolvedor**: Gabriel
- **Versão**: 1.0.0

### Logs Importantes
```bash
# Ver logs em tempo real
npm run pm2:logs

# Histórico completo
cat ~/.pm2/logs/bot-admin-out.log
```

---

🌟 **Desenvolvido por Gabriel** - Bot Admin WhatsApp v1.0.0