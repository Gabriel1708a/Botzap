# 📡 API Bot WhatsApp - Documentação Completa

Sistema de API para integração entre o site Laravel e o Bot WhatsApp para gerenciamento automático de grupos.

## 🔧 Configuração

### 1. Bot WhatsApp
O bot roda um servidor Express na porta configurada (padrão: 3000) que recebe requisições do site Laravel.

```json
// dono/config.json
{
  "panelHandler": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 3000
  }
}
```

### 2. Acesso à API
- **URL Base**: `http://SEU_SERVIDOR:3000`
- **Headers**: `Content-Type: application/json`

## 🚀 Endpoints Disponíveis

### 1. **POST /join-group** - Entrar em Grupo
Faz o bot entrar em um grupo e sincronizar com o painel.

#### Request:
```json
{
  "group_link": "https://chat.whatsapp.com/abc123",
  "user_id": 1,
  "auto_ads": false
}
```

#### Response Success (200):
```json
{
  "success": true,
  "message": "Bot entrou no grupo com sucesso!",
  "data": {
    "group_id": "120363043611185917@g.us",
    "group_name": "Meu Grupo",
    "members_count": 25,
    "bot_is_admin": false,
    "processing_time": 3250,
    "panel_response": {
      "message": "Grupo confirmado e sincronizado com sucesso!",
      "panel_user_id": 1
    }
  }
}
```

#### Response Error (400/500):
```json
{
  "success": false,
  "message": "Link de convite inválido ou expirado.",
  "error_type": "INVALID_INVITE",
  "processing_time": 1500
}
```

### 2. **POST /verify-group** - Verificar Grupo
Verifica se o bot já está em um grupo.

#### Request:
```json
{
  "group_link": "https://chat.whatsapp.com/abc123",
  "user_id": 1
}
```

#### Response:
```json
{
  "success": true,
  "is_member": true,
  "group_info": {
    "id": "120363043611185917@g.us",
    "name": "Meu Grupo",
    "description": "Descrição do grupo",
    "members_count": 25
  }
}
```

### 3. **POST /leave-group** - Sair do Grupo
Remove o bot de um grupo.

#### Request:
```json
{
  "group_id": "120363043611185917@g.us",
  "user_id": 1,
  "reason": "Solicitado pelo usuário"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Bot saiu do grupo com sucesso"
}
```

### 4. **GET /status** - Status do Bot
Verifica o status de conexão do bot.

#### Response:
```json
{
  "success": true,
  "status": "CONNECTED",
  "connected": true,
  "bot_info": {
    "name": "Bot Admin",
    "number": "5543996191225",
    "version": "1.0.0"
  },
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. **GET /health** - Health Check
Endpoint básico para verificar se o servidor está rodando.

#### Response:
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "bot_info": {
    "nome": "Bot Admin",
    "versao": "1.0.0",
    "descricao": "Bot Administrador de Grupos WhatsApp"
  }
}
```

## 🔄 Fluxo de Integração

### 1. **Usuário cadastra grupo no site:**

```javascript
// Frontend do site Laravel
async function cadastrarGrupo(groupLink, userId) {
    const response = await fetch('/api/bot/join-group', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            group_link: groupLink,
            user_id: userId,
            auto_ads: false
        })
    });
    
    const result = await response.json();
    return result;
}
```

### 2. **Site Laravel chama API do bot:**

```php
// Laravel Controller
public function joinGroup(Request $request)
{
    $validated = $request->validate([
        'group_link' => 'required|url',
        'auto_ads' => 'boolean'
    ]);
    
    $response = Http::timeout(30)->post(config('bot.api_url') . '/join-group', [
        'group_link' => $validated['group_link'],
        'user_id' => auth()->id(),
        'auto_ads' => $validated['auto_ads'] ?? false
    ]);
    
    if ($response->successful()) {
        $data = $response->json();
        
        // Grupo foi adicionado automaticamente pelo bot via API /groups/confirm
        return response()->json([
            'success' => true,
            'message' => 'Bot entrou no grupo com sucesso!',
            'group_data' => $data['data']
        ]);
    }
    
    return response()->json([
        'success' => false,
        'message' => 'Erro ao processar grupo: ' . $response->json()['message']
    ], $response->status());
}
```

### 3. **Bot processa e confirma no Laravel:**
O bot automaticamente:
1. Entra no grupo WhatsApp
2. Coleta informações (nome, foto, membros)
3. Envia dados para `/api/groups/confirm`
4. Laravel salva no banco de dados

## 🛡️ Tratamento de Erros

### Tipos de Erro:

| Tipo | Código | Descrição |
|------|--------|-----------|
| `INVALID_INVITE` | 400 | Link inválido ou expirado |
| `BOT_NOT_READY` | 503 | Bot não conectado |
| `BOT_BANNED` | 403 | Bot banido do grupo |
| `WHATSAPP_INTERNAL_ERROR` | 500 | Erro interno WhatsApp |
| `PANEL_CONFIRMATION_ERROR` | 500 | Erro na confirmação com Laravel |
| `UNKNOWN_ERROR` | 500 | Erro não identificado |

### Exemplo de Tratamento no Laravel:

```php
public function handleBotResponse($response)
{
    if (!$response->successful()) {
        $error = $response->json();
        
        switch ($error['error_type']) {
            case 'INVALID_INVITE':
                return 'Link do grupo inválido ou expirado.';
            case 'BOT_NOT_READY':
                return 'Bot temporariamente indisponível. Tente novamente.';
            case 'BOT_BANNED':
                return 'Bot foi banido deste grupo.';
            default:
                return 'Erro inesperado: ' . $error['message'];
        }
    }
    
    return 'Sucesso!';
}
```

## 📋 Controller Laravel Sugerido

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Group;

class BotGroupController extends Controller
{
    private $botApiUrl;
    
    public function __construct()
    {
        $this->botApiUrl = config('services.whatsapp_bot.api_url', 'http://localhost:3000');
    }
    
    /**
     * Solicita para o bot entrar em um grupo
     */
    public function joinGroup(Request $request)
    {
        $validated = $request->validate([
            'group_link' => 'required|url|regex:/chat\.whatsapp\.com/',
            'auto_ads' => 'boolean'
        ]);
        
        try {
            Log::info('[BOT API] Solicitando entrada em grupo', [
                'user_id' => auth()->id(),
                'group_link' => $validated['group_link']
            ]);
            
            $response = Http::timeout(30)->post("{$this->botApiUrl}/join-group", [
                'group_link' => $validated['group_link'],
                'user_id' => auth()->id(),
                'auto_ads' => $validated['auto_ads'] ?? false
            ]);
            
            if ($response->successful()) {
                $data = $response->json();
                
                Log::info('[BOT API] Bot entrou no grupo com sucesso', $data);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Bot entrou no grupo e foi sincronizado!',
                    'data' => $data['data']
                ]);
            }
            
            $error = $response->json();
            Log::error('[BOT API] Erro ao entrar no grupo', $error);
            
            return response()->json([
                'success' => false,
                'message' => $this->getErrorMessage($error),
                'error_type' => $error['error_type'] ?? 'UNKNOWN'
            ], $response->status());
            
        } catch (\Exception $e) {
            Log::error('[BOT API] Exceção ao chamar bot', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Erro de comunicação com o bot. Tente novamente.'
            ], 500);
        }
    }
    
    /**
     * Verifica status do bot
     */
    public function checkBotStatus()
    {
        try {
            $response = Http::timeout(10)->get("{$this->botApiUrl}/status");
            
            if ($response->successful()) {
                return response()->json($response->json());
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Bot indisponível'
            ], 503);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Não foi possível conectar com o bot'
            ], 503);
        }
    }
    
    /**
     * Remove bot de um grupo
     */
    public function leaveGroup(Request $request)
    {
        $validated = $request->validate([
            'group_id' => 'required|string'
        ]);
        
        try {
            $response = Http::timeout(15)->post("{$this->botApiUrl}/leave-group", [
                'group_id' => $validated['group_id'],
                'user_id' => auth()->id(),
                'reason' => 'Solicitado pelo usuário via painel'
            ]);
            
            if ($response->successful()) {
                // Marca grupo como inativo no banco
                Group::where('group_id', $validated['group_id'])
                     ->where('user_id', auth()->id())
                     ->update(['status' => 'inactive']);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Bot removido do grupo com sucesso!'
                ]);
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Erro ao remover bot do grupo'
            ], $response->status());
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro de comunicação com o bot'
            ], 500);
        }
    }
    
    private function getErrorMessage($error)
    {
        switch ($error['error_type'] ?? '') {
            case 'INVALID_INVITE':
                return 'Link do grupo inválido ou expirado.';
            case 'BOT_NOT_READY':
                return 'Bot temporariamente indisponível. Aguarde alguns minutos.';
            case 'BOT_BANNED':
                return 'Bot foi banido deste grupo.';
            case 'PANEL_CONFIRMATION_ERROR':
                return 'Bot entrou no grupo, mas houve erro na sincronização.';
            default:
                return $error['message'] ?? 'Erro desconhecido.';
        }
    }
}
```

## 🔧 Configuração no Laravel

### 1. **Adicionar no `config/services.php`:**
```php
'whatsapp_bot' => [
    'api_url' => env('WHATSAPP_BOT_API_URL', 'http://localhost:3000'),
    'timeout' => env('WHATSAPP_BOT_TIMEOUT', 30),
],
```

### 2. **Adicionar no `.env`:**
```env
WHATSAPP_BOT_API_URL=http://206.183.129.78:3000
WHATSAPP_BOT_TIMEOUT=30
```

### 3. **Rotas (routes/api.php):**
```php
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('bot')->group(function () {
        Route::post('/join-group', [BotGroupController::class, 'joinGroup']);
        Route::post('/leave-group', [BotGroupController::class, 'leaveGroup']);
        Route::get('/status', [BotGroupController::class, 'checkBotStatus']);
    });
});
```

## 🚀 Exemplo de Uso Completo

### Frontend (JavaScript):
```javascript
async function adicionarGrupo(groupLink) {
    try {
        // 1. Verificar status do bot
        const statusResponse = await fetch('/api/bot/status');
        if (!statusResponse.ok) {
            throw new Error('Bot não está disponível');
        }
        
        // 2. Solicitar entrada no grupo
        const response = await fetch('/api/bot/join-group', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                group_link: groupLink,
                auto_ads: false
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Bot entrou no grupo: ' + result.data.group_name);
            location.reload(); // Recarrega página para mostrar novo grupo
        } else {
            alert('❌ Erro: ' + result.message);
        }
        
    } catch (error) {
        alert('❌ Erro de conexão: ' + error.message);
    }
}
```

Agora o sistema está completo com integração bidirecional entre site Laravel e bot WhatsApp! 🎉