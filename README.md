# 🤖 Bot Administrador WhatsApp com Integração Laravel

Sistema completo de bot administrador para grupos WhatsApp com anúncios automáticos e sincronização bidirecional com painel Laravel.

## 📋 Características Principais

- ✅ **Anúncios Automáticos**: Sistema completo de criação, listagem e remoção de anúncios programados
- ✅ **Integração Laravel**: Sincronização automática bidirecional com API Laravel existente
- ✅ **Comandos Modulares**: Sistema dinâmico de carregamento de comandos
- ✅ **Sessão Persistente**: Mantém conexão WhatsApp após reinicializações
- ✅ **Agendamento Inteligente**: Suporte a intervalos flexíveis (minutos, horas, dias)
- ✅ **Reconexão Automática**: Reconecta automaticamente em caso de desconexão
- ✅ **Monitoramento**: Logs detalhados e status em tempo real
- ✅ **Produção**: Suporte completo ao PM2 para ambiente de produção

## 🚀 Instalação Rápida

```bash
# 1. Acesse a pasta do projeto
cd root-bot

# 2. Instale as dependências
npm install

# 3. Configure o bot (edite o arquivo)
cp dono/config.example.json dono/config.json
nano dono/config.json

# 4. Execute o bot
npm start
```

## 📱 Comandos Disponíveis

### 📢 Sistema de Anúncios

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `!addads mensagem\|tempo` | Cria anúncio automático | `!addads Atenção pessoal!\|30m` |
| `!listads` | Lista anúncios ativos | `!listads` |
| `!rmads ID` | Remove anúncio por ID | `!rmads 1` |
| `!menu` | Exibe menu completo | `!menu` |

### ⏰ Formatos de Tempo Suportados

- **Minutos**: `30m`, `45m`, `90m`
- **Horas**: `1h`, `2h`, `12h`
- **Dias**: `1d`, `7d`
- **Combinações**: `2h30m`, `1d12h`, `3h45m`

## 🔄 Integração com Laravel

### Endpoints da API Utilizados

O bot integra automaticamente com os seguintes endpoints do seu painel Laravel:

- `GET /api/ads` - Lista todos os anúncios
- `POST /api/ads` - Cria novo anúncio
- `DELETE /api/ads/{localAdId}` - Remove anúncio por ID local
- `DELETE /api/ads/{id}` - Remove anúncio por ID do banco
- `PATCH /api/ads/{id}/mark-sent` - Marca anúncio como enviado

### Sincronização Automática

- **Intervalo**: A cada 2 minutos
- **Bidirecional**: Bot ↔ Painel Laravel
- **Offline**: Funciona mesmo com painel indisponível
- **Conflitos**: Resolve automaticamente diferenças

## 📁 Estrutura do Projeto

```
root-bot/
├── 📂 commands/           # Comandos do bot
│   ├── 📄 addads.js      # Comando para criar anúncios
│   ├── 📄 listads.js     # Comando para listar anúncios
│   ├── 📄 rmads.js       # Comando para remover anúncios
│   └── 📄 menu.js        # Menu principal do bot
│
├── 📂 handlers/           # Integrações e handlers
│   └── 📄 adsHandler.js  # Handler de sincronização Laravel
│
├── 📂 dono/              # Configurações do bot
│   ├── 📄 config.json    # Configuração principal
│   └── 📄 config.example.json # Modelo de configuração
│
├── 📄 index.js           # Arquivo principal do bot
├── 📄 package.json       # Dependências e scripts
├── 📄 README.md          # Documentação completa
└── 📄 .gitignore         # Arquivos ignorados
```

## ⚙️ Configuração

### Arquivo `dono/config.json`

```json
{
  "numeroBot": "5543996191225",           // Número do WhatsApp do bot
  "numeroDono": "554191236158",           // SEU número (quem pode usar)
  "prefix": "!",                          // Prefixo dos comandos
  "timezone": "America/Sao_Paulo",        // Fuso horário
  "autoReconnect": true,                  // Reconexão automática
  "sessaoPersistente": true,              // Manter sessão
  "laravelApi": {
    "enabled": true,                      // Ativar integração Laravel
    "baseUrl": "https://painel.botwpp.tech/api",
    "token": "gabriel17"                  // Token de autenticação
  },
  "botInfo": {
    "nome": "Bot Admin",
    "versao": "1.0.0",
    "descricao": "Bot Administrador de Grupos WhatsApp"
  }
}
```

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm start                 # Execução simples
npm run dev              # Com nodemon (auto-reload)

# Produção com PM2
npm run pm2:start        # Iniciar bot em produção
npm run pm2:logs         # Ver logs em tempo real
npm run pm2:restart      # Reiniciar bot
npm run pm2:stop         # Parar bot
```

## 📊 Funcionalidades Avançadas

### 🔒 Sistema de Segurança
- ✅ Apenas o dono configurado pode usar comandos
- ✅ Anúncios funcionam apenas em grupos
- ✅ Validação completa de entrada
- ✅ Limites de tempo (1 minuto a 7 dias)

### 📈 Monitoramento
- ✅ Logs detalhados no console
- ✅ Status em tempo real via `!menu`
- ✅ Contadores de anúncios ativos
- ✅ Histórico de execução

### 🔄 Robustez
- ✅ Reconexão automática do WhatsApp
- ✅ Cache local para modo offline
- ✅ Tratamento de erros abrangente
- ✅ Graceful shutdown

## 🆘 Solução de Problemas

### Bot não conecta ao WhatsApp
```bash
# Deletar sessão e tentar novamente
rm -rf sessions/
npm start
```

### Erro de API Laravel
```bash
# Testar conectividade
curl -H "Authorization: Bearer SEU_TOKEN" https://painel.botwpp.tech/api/ads
```

### Ver logs detalhados
```bash
# Logs em tempo real
npm run pm2:logs

# Logs do sistema
journalctl -u bot-admin -f
```

## 🔧 Expansão do Sistema

### Adicionar Novos Comandos

1. Crie um arquivo na pasta `commands/`
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
        // Sua lógica aqui
        message.reply('Comando executado!');
    }
};
```

3. Reinicie o bot - será carregado automaticamente

## 🌟 Exemplo de Uso Completo

```bash
# 1. Criar anúncio que roda a cada 30 minutos
!addads Bem-vindos ao nosso grupo! Leiam as regras.|30m

# 2. Criar anúncio diário
!addads Backup diário realizado com sucesso!|1d

# 3. Ver todos os anúncios
!listads

# 4. Remover anúncio específico
!rmads 1

# 5. Ver status completo
!menu
```

## 📞 Suporte

- **Desenvolvedor**: Gabriel
- **Versão**: 1.0.0
- **Compatibilidade**: Node.js 18+
- **Plataforma**: Linux, Windows, macOS

## 📄 Licença

MIT License - Veja o arquivo LICENSE para detalhes.

---

🚀 **Bot Admin WhatsApp** - Sistema completo de administração de grupos com integração Laravel